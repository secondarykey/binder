package fs

import (
	"bytes"
	"regexp"
	"sort"
	"strings"

	"golang.org/x/xerrors"
)

// RootFileInfo はバインダールートに置かれたユーザーファイルの情報を保持する。
type RootFileInfo struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// rootFileNamePattern は先頭がドット以外の英数字で始まるファイル名を許可する。
var rootFileNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._\-]*$`)

// reservedRootNames はバインダーが予約しているルート直下の名前（小文字比較）。
var reservedRootNames = map[string]bool{
	BinderMetaFile: true,
	".gitignore":   true,
	UserFileName:   true,
	".ds_store":    true,
	".worktree":    true,
	".git":         true,
	NoteDir:        true,
	DiagramDir:     true,
	AssetDir:       true,
	LayerDir:       true,
	TemplateDir:    true,
	PluginDir:      true,
	DBDir:          true,
}

// isReservedRootName はルート直下の予約名かどうかを返す。
// Windows のファイルシステムは大文字小文字を区別しないため小文字で比較する。
func isReservedRootName(name string) bool {
	lower := strings.ToLower(name)
	if reservedRootNames[lower] {
		return true
	}
	// 公開ディレクトリ（既定 docs）は変更可能なため別途比較する
	return lower == strings.ToLower(publishDir)
}

// ValidateRootFileName はルートファイル名として利用可能かを検証する。
func ValidateRootFileName(name string) error {
	if !rootFileNamePattern.MatchString(name) {
		return xerrors.Errorf("invalid root file name: %s", name)
	}
	if isReservedRootName(name) {
		return xerrors.Errorf("reserved root file name: %s", name)
	}
	return nil
}

// ListRootFiles はバインダールート直下のユーザーファイル一覧を返す（内容なし）。
// 予約名・ディレクトリ・隠しファイルは除外する。
func (sys *FileSystem) ListRootFiles() ([]RootFileInfo, error) {

	entries, err := sys.ReadDir(".")
	if err != nil {
		return nil, xerrors.Errorf("ReadDir(.) error: %w", err)
	}

	var result []RootFileInfo
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || isReservedRootName(name) || strings.HasPrefix(name, ".") {
			continue
		}
		result = append(result, RootFileInfo{Name: name})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	if result == nil {
		result = []RootFileInfo{}
	}
	return result, nil
}

// ReadRootFile はルートファイルの内容を返す。
func (sys *FileSystem) ReadRootFile(name string) (string, error) {

	if err := ValidateRootFileName(name); err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := sys.readFile(&buf, name); err != nil {
		return "", xerrors.Errorf("readFile(%s) error: %w", name, err)
	}
	return buf.String(), nil
}

// WriteRootFile はルートファイルを書き込む（作成・上書き）。
// コミットは行わない（未記録一覧から記録する）。
func (sys *FileSystem) WriteRootFile(name string, content []byte) (string, error) {

	if err := ValidateRootFileName(name); err != nil {
		return "", err
	}

	if err := sys.writeFile(name, bytes.NewReader(content)); err != nil {
		return "", xerrors.Errorf("writeFile(%s) error: %w", name, err)
	}
	return name, nil
}

// DeleteRootFile はルートファイルを削除する。
// コミットは行わない（未記録一覧から記録する）。
func (sys *FileSystem) DeleteRootFile(name string) (string, error) {

	if err := ValidateRootFileName(name); err != nil {
		return "", err
	}

	if !sys.isExist(name) {
		return "", xerrors.Errorf("root file not found: %s", name)
	}

	if err := sys.remove(name); err != nil {
		return "", xerrors.Errorf("remove(%s) error: %w", name, err)
	}
	return name, nil
}

// RenameRootFile はルートファイルをリネームする。
// 旧ファイルを削除し、新名で書き込む。コミットは行わない。
func (sys *FileSystem) RenameRootFile(oldName, newName string) ([]string, error) {

	if err := ValidateRootFileName(oldName); err != nil {
		return nil, err
	}
	if err := ValidateRootFileName(newName); err != nil {
		return nil, err
	}

	if !sys.isExist(oldName) {
		return nil, xerrors.Errorf("root file not found: %s", oldName)
	}
	if sys.isExist(newName) {
		return nil, xerrors.Errorf("root file already exists: %s", newName)
	}

	var buf bytes.Buffer
	if err := sys.readFile(&buf, oldName); err != nil {
		return nil, xerrors.Errorf("readFile(%s) error: %w", oldName, err)
	}

	if err := sys.writeFile(newName, bytes.NewReader(buf.Bytes())); err != nil {
		return nil, xerrors.Errorf("writeFile(%s) error: %w", newName, err)
	}

	if err := sys.remove(oldName); err != nil {
		return nil, xerrors.Errorf("remove(%s) error: %w", oldName, err)
	}

	return []string{oldName, newName}, nil
}
