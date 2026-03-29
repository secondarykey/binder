package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/utils/merkletrie"
	"golang.org/x/xerrors"
)

const structureRootId = "index"

// MergeAnalysis は3-way比較の結果を保持する。
type MergeAnalysis struct {
	BaseHash       plumbing.Hash
	OursHash       plumbing.Hash
	TheirsHash     plumbing.Hash
	AutoFiles      []ResolvedFile        // 自動解決済み
	Conflicts      []ConflictFile        // ユーザー選択が必要
	MergedCSVs     map[string]string     // CSVマージ結果（path→content）
	MergedCSVInfos map[string]*MergedCSV // CSVマージ詳細（ログ用）
}

// MergeLog はマージ操作の詳細ログ。ノートとして記録するために使用。
type MergeLog struct {
	RemoteName   string
	RemoteBranch string
	LocalBranch  string
	AutoFiles    []ResolvedFile
	MergedCSVs   map[string]*MergedCSV
	UserFiles    []FileResolution
}

// ResolvedFile は自動解決されたファイル。
type ResolvedFile struct {
	Path       string
	Resolution string // "ours" or "theirs"
}

// ConflictFile は競合しているファイル。
type ConflictFile struct {
	Path        string
	Type        string // note/diagram/asset/template/db/other
	Id          string
	Name        string
	OursAction  string // modified/deleted/added
	TheirAction string
}

// FileResolution はユーザーが選択したファイル解決。
type FileResolution struct {
	Path       string
	Resolution string // "ours" or "theirs"
}

// DetectConflicts は3-way比較でコンフリクトを検出する。
func (f *FileSystem) DetectConflicts(remoteName, branchName string) (*MergeAnalysis, error) {

	// HEAD とリモートのコミットを取得
	head, err := f.repo.Head()
	if err != nil {
		return nil, xerrors.Errorf("repository Head() error: %w", err)
	}
	oursHash := head.Hash()

	remoteRef, err := f.repo.Reference(
		plumbing.ReferenceName(fmt.Sprintf("refs/remotes/%s/%s", remoteName, branchName)), true)
	if err != nil {
		return nil, xerrors.Errorf("Reference() error: %w", err)
	}
	theirsHash := remoteRef.Hash()

	oursCommit, err := f.repo.CommitObject(oursHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(ours) error: %w", err)
	}
	theirsCommit, err := f.repo.CommitObject(theirsHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(theirs) error: %w", err)
	}

	// マージベース（共通祖先）を取得
	bases, err := oursCommit.MergeBase(theirsCommit)
	if err != nil {
		return nil, xerrors.Errorf("MergeBase() error: %w", err)
	}
	if len(bases) == 0 {
		return nil, fmt.Errorf("no common ancestor found")
	}
	baseCommit := bases[0]

	// 3つのツリーを取得
	baseTree, err := baseCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("baseCommit.Tree() error: %w", err)
	}
	oursTree, err := oursCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("oursCommit.Tree() error: %w", err)
	}
	theirsTree, err := theirsCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("theirsCommit.Tree() error: %w", err)
	}

	return f.analyzeChanges(baseCommit.Hash, oursHash, theirsHash, baseTree, oursTree, theirsTree)
}

// DetectConflictsByHash はコミットハッシュ文字列から MergeAnalysis を生成する。
// ApplyMergeResolution で使用（remoteName/branchName が不要）。
func (f *FileSystem) DetectConflictsByHash(oursHashStr, theirsHashStr string) (*MergeAnalysis, error) {

	oursHash := plumbing.NewHash(oursHashStr)
	theirsHash := plumbing.NewHash(theirsHashStr)

	oursCommit, err := f.repo.CommitObject(oursHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(ours) error: %w", err)
	}
	theirsCommit, err := f.repo.CommitObject(theirsHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(theirs) error: %w", err)
	}

	bases, err := oursCommit.MergeBase(theirsCommit)
	if err != nil {
		return nil, xerrors.Errorf("MergeBase() error: %w", err)
	}
	if len(bases) == 0 {
		return nil, fmt.Errorf("no common ancestor found")
	}
	baseCommit := bases[0]

	baseTree, err := baseCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("baseCommit.Tree() error: %w", err)
	}
	oursTree, err := oursCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("oursCommit.Tree() error: %w", err)
	}
	theirsTree, err := theirsCommit.Tree()
	if err != nil {
		return nil, xerrors.Errorf("theirsCommit.Tree() error: %w", err)
	}

	return f.analyzeChanges(baseCommit.Hash, oursHash, theirsHash, baseTree, oursTree, theirsTree)
}

// isDBCSV は DB ディレクトリ内のCSVファイルかを判定する。
func isDBCSV(path string) bool {
	return strings.HasPrefix(path, DBDir+"/") && strings.HasSuffix(path, ".csv")
}

// isStructureCSV は structures.csv かを判定する。
func isStructureCSV(path string) bool {
	return path == DBDir+"/structures.csv"
}

// analyzeChanges は3つのツリーを比較してコンフリクトを分類する。
// DB CSVファイルは行単位の3-wayマージで自動解決する。
func (f *FileSystem) analyzeChanges(baseHash, oursHash, theirsHash plumbing.Hash,
	baseTree, oursTree, theirsTree *object.Tree) (*MergeAnalysis, error) {

	baseCommit, err := f.repo.CommitObject(baseHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(base) error: %w", err)
	}
	oursCommit, err := f.repo.CommitObject(oursHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(ours) error: %w", err)
	}
	theirsCommit, err := f.repo.CommitObject(theirsHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(theirs) error: %w", err)
	}

	oursChanges, err := baseTree.Diff(oursTree)
	if err != nil {
		return nil, xerrors.Errorf("baseTree.Diff(ours) error: %w", err)
	}
	theirsChanges, err := baseTree.Diff(theirsTree)
	if err != nil {
		return nil, xerrors.Errorf("baseTree.Diff(theirs) error: %w", err)
	}

	type changeInfo struct {
		action merkletrie.Action
		toHash plumbing.Hash
	}

	oursMap := make(map[string]*changeInfo)
	for _, c := range oursChanges {
		path := changePath(c)
		action, err := c.Action()
		if err != nil {
			continue
		}
		ci := &changeInfo{action: action}
		if action != merkletrie.Delete {
			ci.toHash = c.To.TreeEntry.Hash
		}
		oursMap[path] = ci
	}

	theirsMap := make(map[string]*changeInfo)
	for _, c := range theirsChanges {
		path := changePath(c)
		action, err := c.Action()
		if err != nil {
			continue
		}
		ci := &changeInfo{action: action}
		if action != merkletrie.Delete {
			ci.toHash = c.To.TreeEntry.Hash
		}
		theirsMap[path] = ci
	}

	analysis := &MergeAnalysis{
		BaseHash:       baseHash,
		OursHash:       oursHash,
		TheirsHash:     theirsHash,
		MergedCSVs:     make(map[string]string),
		MergedCSVInfos: make(map[string]*MergedCSV),
	}

	// ours のみの変更 → auto: ours
	for path := range oursMap {
		if _, both := theirsMap[path]; !both {
			analysis.AutoFiles = append(analysis.AutoFiles, ResolvedFile{
				Path: path, Resolution: "ours",
			})
		}
	}

	// theirs のみの変更 → auto: theirs
	for path := range theirsMap {
		if _, both := oursMap[path]; !both {
			analysis.AutoFiles = append(analysis.AutoFiles, ResolvedFile{
				Path: path, Resolution: "theirs",
			})
		}
	}

	// 両方変更 → 同じハッシュなら auto、違えば conflict or CSV merge
	for path, ours := range oursMap {
		theirs, both := theirsMap[path]
		if !both {
			continue
		}

		if ours.action != merkletrie.Delete && theirs.action != merkletrie.Delete &&
			ours.toHash == theirs.toHash {
			analysis.AutoFiles = append(analysis.AutoFiles, ResolvedFile{
				Path: path, Resolution: "ours",
			})
			continue
		}

		// DB CSV は行単位マージで自動解決を試みる
		if isDBCSV(path) && ours.action != merkletrie.Delete && theirs.action != merkletrie.Delete {
			merged, err := mergeCSVFiles(
				baseCommit, oursCommit, theirsCommit,
				path, isStructureCSV(path), structureRootId,
			)
			if err == nil {
				content := renderCSV(merged.Header, merged.Rows)
				analysis.MergedCSVs[path] = content
				analysis.MergedCSVInfos[path] = merged
				analysis.AutoFiles = append(analysis.AutoFiles, ResolvedFile{
					Path: path, Resolution: "merged",
				})
				continue
			}
			// CSV マージ失敗時はコンフリクトとして扱う
		}

		cf := ConflictFile{
			Path:        path,
			OursAction:  actionToString(ours.action),
			TheirAction: actionToString(theirs.action),
		}

		mod, err := getModelType(path)
		if err != nil {
			cf.Type = "other"
			cf.Name = path
		} else {
			cf.Type = mod.Typ
			cf.Id = mod.Id
			cf.Name = path
		}

		analysis.Conflicts = append(analysis.Conflicts, cf)
	}

	return analysis, nil
}

// ApplyResolutions はファイル解決を適用してマージコミットを作成する。
// 戻り値の MergeLog にはマージの詳細情報が含まれる。
func (f *FileSystem) ApplyResolutions(analysis *MergeAnalysis, userResolutions []FileResolution) (*MergeLog, error) {

	oursCommit, err := f.repo.CommitObject(analysis.OursHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(ours) error: %w", err)
	}
	theirsCommit, err := f.repo.CommitObject(analysis.TheirsHash)
	if err != nil {
		return nil, xerrors.Errorf("CommitObject(theirs) error: %w", err)
	}

	wt, err := f.repo.Worktree()
	if err != nil {
		return nil, xerrors.Errorf("Worktree() error: %w", err)
	}

	// 全ての解決（自動 + ユーザー選択）を統合
	allResolutions := make(map[string]string)
	for _, r := range analysis.AutoFiles {
		allResolutions[r.Path] = r.Resolution
	}
	for _, r := range userResolutions {
		allResolutions[r.Path] = r.Resolution
	}

	// 各ファイルに解決を適用
	for path, resolution := range allResolutions {
		fullPath := filepath.Join(f.base, filepath.FromSlash(path))

		// CSVマージ結果がある場合はそれを使用
		if resolution == "merged" {
			if content, ok := analysis.MergedCSVs[path]; ok {
				dir := filepath.Dir(fullPath)
				if err := os.MkdirAll(dir, 0755); err != nil {
					return nil, xerrors.Errorf("MkdirAll(%s) error: %w", dir, err)
				}
				if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
					return nil, xerrors.Errorf("WriteFile(%s) error: %w", path, err)
				}
				if _, err := wt.Add(path); err != nil {
					return nil, xerrors.Errorf("Add(%s) error: %w", path, err)
				}
				continue
			}
			// MergedCSVs に無い場合は ours にフォールバック
			resolution = "ours"
		}

		var sourceCommit *object.Commit
		if resolution == "theirs" {
			sourceCommit = theirsCommit
		} else {
			sourceCommit = oursCommit
		}

		file, err := sourceCommit.File(path)
		if err != nil {
			// ファイルが存在しない = 削除
			os.Remove(fullPath)
			wt.Remove(path)
			continue
		}

		// ファイル内容を書き込み
		content, err := file.Contents()
		if err != nil {
			return nil, xerrors.Errorf("File.Contents(%s) error: %w", path, err)
		}

		dir := filepath.Dir(fullPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, xerrors.Errorf("MkdirAll(%s) error: %w", dir, err)
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return nil, xerrors.Errorf("WriteFile(%s) error: %w", path, err)
		}

		if _, err := wt.Add(path); err != nil {
			return nil, xerrors.Errorf("Add(%s) error: %w", path, err)
		}
	}

	// マージコミット（2親）
	sig := f.userSigOrDefault()
	_, err = wt.Commit("Merge remote branch", &git.CommitOptions{
		Author: sig,
		Parents: []plumbing.Hash{
			analysis.OursHash,
			analysis.TheirsHash,
		},
	})
	if err != nil {
		return nil, xerrors.Errorf("merge Commit() error: %w", err)
	}

	mergeLog := &MergeLog{
		AutoFiles:  analysis.AutoFiles,
		MergedCSVs: analysis.MergedCSVInfos,
		UserFiles:  userResolutions,
	}

	return mergeLog, nil
}

// changePath は Change からファイルパスを取得する。
func changePath(c *object.Change) string {
	if c.To.Name != "" {
		return c.To.Name
	}
	return c.From.Name
}

func actionToString(a merkletrie.Action) string {
	switch a {
	case merkletrie.Insert:
		return "added"
	case merkletrie.Delete:
		return "deleted"
	case merkletrie.Modify:
		return "modified"
	default:
		return "unknown"
	}
}
