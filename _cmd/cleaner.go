package main

// cleaner.go: 不要になった git worktree の物理ディレクトリを掃除するツール。
//
// 使い方: go run ./_cmd/cleaner.go [-n] [-y]
//
//	-n: dry-run（削除候補の表示のみ）
//	-y: 確認プロンプトを省略して削除
//
// 以下を削除候補とする。
//  1. git worktree に登録されているが、チェックアウト先ブランチが既に存在しないワークツリー
//  2. 物理ディレクトリが既に存在しない登録（git worktree prune 相当）
//  3. .claude/worktrees 配下にあるが、git worktree に登録されていない孤児ディレクトリ
//     （登録が prune 済みでも物理が残るケースはここで拾う）
//
// メインワークツリー・カレントディレクトリを含むワークツリー・locked・detached は対象外。
// 物理削除は os.RemoveAll で行う。os.RemoveAll は junction/symlink の中身を辿らず
// リンク自体のみを削除するため、node_modules Junction が残っていてもリンク先を破壊しない。

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// claudeWorktreesDir はメインワークツリー直下の Claude Code 用ワークツリー置き場
const claudeWorktreesDir = ".claude/worktrees"

// worktreeInfo は git worktree list --porcelain の1エントリ
type worktreeInfo struct {
	path     string
	branch   string // refs/heads/ を除いたブランチ名（detached 時は空）
	detached bool
	locked   bool
	prunable bool
}

func main() {

	dryRun := flag.Bool("n", false, "dry-run（削除候補の表示のみ）")
	yes := flag.Bool("y", false, "確認プロンプトを省略して削除")
	flag.Parse()

	if err := runCleaner(*dryRun, *yes); err != nil {
		fmt.Fprintf(os.Stderr, "error: %+v\n", err)
		os.Exit(1)
	}
}

func runCleaner(dryRun, yes bool) error {

	worktrees, err := listGitWorktrees()
	if err != nil {
		return err
	}
	if len(worktrees) == 0 {
		return fmt.Errorf("git worktree list の結果が空です")
	}

	// 先頭エントリがメインワークツリー
	mainRoot := worktrees[0].path

	branches, err := listBranches()
	if err != nil {
		return err
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	cwd, err = filepath.Abs(cwd)
	if err != nil {
		return err
	}

	var removes []*worktreeInfo // ブランチ消滅済み → 物理削除 + prune
	var prunes []*worktreeInfo  // 物理消滅済み → prune のみ
	var orphans []string        // git 未登録の孤児ディレクトリ → 物理削除

	for _, wt := range worktrees[1:] {

		if isSamePath(wt.path, cwd) || isUnderPath(cwd, wt.path) {
			// 自分自身がいるワークツリーは削除しない
			continue
		}
		if wt.locked {
			fmt.Printf("skip (locked): %s\n", wt.path)
			continue
		}
		if wt.prunable || !dirExists(wt.path) {
			prunes = append(prunes, wt)
			continue
		}
		if wt.detached {
			// detached は意図的な可能性があるため報告のみ
			fmt.Printf("skip (detached HEAD): %s\n", wt.path)
			continue
		}
		if _, ok := branches[wt.branch]; !ok {
			removes = append(removes, wt)
		}
	}

	// .claude/worktrees 配下で git worktree に登録されていない孤児ディレクトリを探す。
	// 登録が prune 済みのディレクトリは git worktree list に出ないため、物理スキャンでのみ検出できる。
	orphans, err = findOrphanDirs(filepath.Join(mainRoot, filepath.FromSlash(claudeWorktreesDir)), worktrees, cwd)
	if err != nil {
		return err
	}

	if len(removes) == 0 && len(prunes) == 0 && len(orphans) == 0 {
		fmt.Println("削除対象はありません")
		return nil
	}

	// 削除候補の表示
	for _, wt := range removes {
		fmt.Printf("remove (branch %q は削除済み): %s\n", wt.branch, wt.path)
	}
	for _, wt := range prunes {
		fmt.Printf("prune  (物理ディレクトリなし): %s\n", wt.path)
	}
	for _, dir := range orphans {
		fmt.Printf("orphan (git worktree 未登録): %s\n", dir)
	}

	if dryRun {
		fmt.Println("dry-run のため削除は行いません")
		return nil
	}

	if !yes && !confirm() {
		fmt.Println("キャンセルしました")
		return nil
	}

	for _, wt := range removes {
		// git worktree remove に物理削除させると junction の先を辿る恐れがあるため、
		// os.RemoveAll で消してから prune で登録を掃除する
		if err := os.RemoveAll(wt.path); err != nil {
			return fmt.Errorf("削除に失敗しました %s: %w", wt.path, err)
		}
		fmt.Println("Removed:", wt.path)
	}

	for _, dir := range orphans {
		if err := os.RemoveAll(dir); err != nil {
			return fmt.Errorf("削除に失敗しました %s: %w", dir, err)
		}
		fmt.Println("Removed:", dir)
	}

	if len(removes) > 0 || len(prunes) > 0 {
		if _, err := gitOutput("worktree", "prune"); err != nil {
			return err
		}
		fmt.Println("Pruned: git worktree prune")
	}

	fmt.Println("Success")
	return nil
}

// listGitWorktrees は git worktree list --porcelain を解析する
func listGitWorktrees() ([]*worktreeInfo, error) {

	out, err := gitOutput("worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}

	var rtn []*worktreeInfo
	var cur *worktreeInfo

	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimRight(line, "\r")
		switch {
		case strings.HasPrefix(line, "worktree "):
			cur = &worktreeInfo{path: filepath.Clean(strings.TrimPrefix(line, "worktree "))}
			rtn = append(rtn, cur)
		case cur == nil:
			// worktree 行より前は無視
		case strings.HasPrefix(line, "branch "):
			cur.branch = strings.TrimPrefix(strings.TrimPrefix(line, "branch "), "refs/heads/")
		case line == "detached":
			cur.detached = true
		case line == "locked" || strings.HasPrefix(line, "locked "):
			cur.locked = true
		case line == "prunable" || strings.HasPrefix(line, "prunable "):
			cur.prunable = true
		}
	}

	return rtn, nil
}

// listBranches はローカルブランチ名の集合を返す
func listBranches() (map[string]struct{}, error) {

	out, err := gitOutput("for-each-ref", "--format=%(refname:short)", "refs/heads")
	if err != nil {
		return nil, err
	}

	rtn := make(map[string]struct{})
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			rtn[line] = struct{}{}
		}
	}
	return rtn, nil
}

// findOrphanDirs は dir 配下で git worktree に登録されていないディレクトリを返す
func findOrphanDirs(dir string, worktrees []*worktreeInfo, cwd string) ([]string, error) {

	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var rtn []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		p := filepath.Join(dir, entry.Name())
		if isSamePath(p, cwd) || isUnderPath(cwd, p) {
			continue
		}
		registered := false
		for _, wt := range worktrees {
			if isSamePath(p, wt.path) {
				registered = true
				break
			}
		}
		if !registered {
			rtn = append(rtn, p)
		}
	}
	return rtn, nil
}

func confirm() bool {
	fmt.Print("上記を削除しますか? [y/N]: ")
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return false
	}
	ans := strings.ToLower(strings.TrimSpace(scanner.Text()))
	return ans == "y" || ans == "yes"
}

func gitOutput(args ...string) (string, error) {
	out, err := exec.Command("git", args...).Output()
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, string(ee.Stderr))
		}
		return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return string(out), nil
}

func dirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}

// isSamePath は Windows の大文字小文字を無視してパスの一致を判定する
func isSamePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

// isUnderPath は child が parent 配下にあるかを判定する（大文字小文字は無視）
func isUnderPath(child, parent string) bool {
	rel, err := filepath.Rel(
		strings.ToLower(filepath.Clean(parent)),
		strings.ToLower(filepath.Clean(child)))
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
