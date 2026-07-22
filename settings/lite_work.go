package settings

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/xerrors"
)

// ワーク（保存前の Untitled タブ）は ~/.binder/lite/works/<name>.md に保存する。
// ファイルとして保存された時点でワークは削除される。
const (
	LiteWorkDirName = "works"
	LiteWorkExt     = ".md"
	// 名前探索の上限（無限ループ防止）
	liteWorkMaxIndex = 999
)

// LiteWork は保存前の一時作業（Untitled タブ）。
type LiteWork struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// liteWorkNamePattern は "Untitled" / "Untitled-2" のみを許可する。
// フロントエンドから渡される名前でパスを組み立てるため、必ずこれで検証する。
var liteWorkNamePattern = regexp.MustCompile(`^Untitled(-[1-9][0-9]*)?$`)

// LiteWorkDirPath は ~/.binder/lite/works のパスを返す。
func LiteWorkDirPath() string {
	return filepath.Join(LiteDirPath(), LiteWorkDirName)
}

// liteWorkName は連番からワーク名を作る（1 は "Untitled"）。
func liteWorkName(index int) string {
	if index <= 1 {
		return "Untitled"
	}
	return "Untitled-" + strconv.Itoa(index)
}

// liteWorkIndex はワーク名から連番を取り出す（"Untitled" は 1）。
func liteWorkIndex(name string) int {
	_, num, found := strings.Cut(name, "-")
	if !found {
		return 1
	}
	i, err := strconv.Atoi(num)
	if err != nil {
		return 1
	}
	return i
}

// liteWorkPath は名前を検証したうえでワークファイルのパスを返す。
func liteWorkPath(name string) (string, error) {
	if !liteWorkNamePattern.MatchString(name) {
		return "", xerrors.Errorf("invalid work name: %q", name)
	}
	return filepath.Join(LiteWorkDirPath(), name+LiteWorkExt), nil
}

// ListLiteWorks は保存されているワークを連番順に返す。
// ワークディレクトリが無い場合は空を返す。
func ListLiteWorks() ([]*LiteWork, error) {

	dir := LiteWorkDirPath()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*LiteWork{}, nil
		}
		return nil, xerrors.Errorf("os.ReadDir(%s) error: %w", dir, err)
	}

	works := make([]*LiteWork, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), LiteWorkExt) {
			continue
		}
		name := strings.TrimSuffix(e.Name(), LiteWorkExt)
		if !liteWorkNamePattern.MatchString(name) {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		works = append(works, &LiteWork{Name: name, Content: string(data)})
	}

	sort.Slice(works, func(i, j int) bool {
		return liteWorkIndex(works[i].Name) < liteWorkIndex(works[j].Name)
	})
	return works, nil
}

// CreateLiteWork は未使用の名前で空のワークファイルを作成し、その名前を返す。
// ファイルを即座に作ることで名前の予約も兼ねる（複数ウィンドウでの衝突を防ぐ）。
func CreateLiteWork() (string, error) {

	dir := LiteWorkDirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	for i := 1; i <= liteWorkMaxIndex; i++ {
		name := liteWorkName(i)
		p := filepath.Join(dir, name+LiteWorkExt)
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			if os.IsExist(err) {
				continue
			}
			return "", xerrors.Errorf("os.OpenFile(%s) error: %w", p, err)
		}
		f.Close()
		return name, nil
	}
	return "", xerrors.Errorf("lite work name exhausted (max %d)", liteWorkMaxIndex)
}

// SaveLiteWork はワークの内容を書き込む。
func SaveLiteWork(name, content string) error {

	p, err := liteWorkPath(name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll() error: %w", err)
	}
	if err := os.WriteFile(p, []byte(content), 0644); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
	}
	return nil
}

// DeleteLiteWork はワークを削除する。存在しない場合は何もしない。
func DeleteLiteWork(name string) error {

	p, err := liteWorkPath(name)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return xerrors.Errorf("os.Remove(%s) error: %w", p, err)
	}
	return nil
}
