package fs

import (
	"binder/log"
	"bytes"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/xerrors"
)

type PluginInfo struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// ReadPlugins はエンジンディレクトリ内の全JSプラグインをアルファベット順に返す。
// ディレクトリが存在しない場合は空スライスを返す。
func (sys *FileSystem) ReadPlugins(engine string) ([]PluginInfo, error) {

	dir := PluginEngineDir(engine)

	if _, err := sys.fs.Stat(dir); err != nil {
		log.Info("plugins directory not found: %s", dir)
		return []PluginInfo{}, nil
	}

	entries, err := sys.ReadDir(dir)
	if err != nil {
		return nil, xerrors.Errorf("ReadDir(%s) error: %w", dir, err)
	}

	var jsFiles []fs.DirEntry
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".js") {
			continue
		}
		jsFiles = append(jsFiles, e)
	}

	sort.Slice(jsFiles, func(i, j int) bool {
		return jsFiles[i].Name() < jsFiles[j].Name()
	})

	plugins := make([]PluginInfo, 0, len(jsFiles))
	for _, e := range jsFiles {
		var buf bytes.Buffer
		fn := filepath.Join(dir, e.Name())
		if err := sys.readFile(&buf, fn); err != nil {
			log.Warn("plugin read error %s: %+v", e.Name(), err)
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".js")
		log.Info("plugin loaded: %s/%s", engine, name)
		plugins = append(plugins, PluginInfo{
			Name:    name,
			Content: buf.String(),
		})
	}

	log.Info("plugins found: %d (%s)", len(plugins), engine)
	return plugins, nil
}

// ListPlugins はエンジンディレクトリ内のプラグイン名一覧を返す（内容なし）。
func (sys *FileSystem) ListPlugins(engine string) ([]PluginInfo, error) {

	dir := PluginEngineDir(engine)

	if _, err := sys.fs.Stat(dir); err != nil {
		return []PluginInfo{}, nil
	}

	entries, err := sys.ReadDir(dir)
	if err != nil {
		return nil, xerrors.Errorf("ReadDir(%s) error: %w", dir, err)
	}

	var result []PluginInfo
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".js") {
			continue
		}
		result = append(result, PluginInfo{
			Name: strings.TrimSuffix(e.Name(), ".js"),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

// WritePlugin はエンジンディレクトリにプラグインJSファイルを書き込む（作成・上書き）。
// エンジンディレクトリが存在しない場合は作成する。
// gitステージングは呼び出し元が CommitAll/Commit で行う。
// 書き込んだファイルパスを返す。
func (sys *FileSystem) WritePlugin(engine, name string, content []byte) (string, error) {

	dir := PluginEngineDir(engine)

	if err := sys.mkdir(dir); err != nil {
		return "", xerrors.Errorf("mkdir(%s) error: %w", dir, err)
	}

	fn := filepath.Join(dir, name+".js")
	if err := sys.writeFile(fn, bytes.NewReader(content)); err != nil {
		return "", xerrors.Errorf("writeFile(%s) error: %w", fn, err)
	}

	return fn, nil
}

// DeletePlugin はエンジンディレクトリのプラグインJSファイルを削除してgitインデックスに反映する。
// 削除したファイルパスを返す。
func (sys *FileSystem) DeletePlugin(engine, name string) (string, error) {

	fn := filepath.Join(PluginEngineDir(engine), name+".js")

	if !sys.isExist(fn) {
		return "", xerrors.Errorf("plugin file not found: %s", fn)
	}

	if err := sys.remove(fn); err != nil {
		return "", xerrors.Errorf("remove(%s) error: %w", fn, err)
	}

	return fn, nil
}

// RenamePlugin はプラグインファイルをリネームする。
// 旧ファイルを削除し、新名で書き込む。
func (sys *FileSystem) RenamePlugin(engine, oldName, newName string) ([]string, error) {

	dir := PluginEngineDir(engine)
	oldFn := filepath.Join(dir, oldName+".js")
	newFn := filepath.Join(dir, newName+".js")

	if !sys.isExist(oldFn) {
		return nil, xerrors.Errorf("plugin file not found: %s", oldFn)
	}
	if sys.isExist(newFn) {
		return nil, xerrors.Errorf("plugin file already exists: %s", newFn)
	}

	var buf bytes.Buffer
	if err := sys.readFile(&buf, oldFn); err != nil {
		return nil, xerrors.Errorf("readFile(%s) error: %w", oldFn, err)
	}

	if err := sys.writeFile(newFn, bytes.NewReader(buf.Bytes())); err != nil {
		return nil, xerrors.Errorf("writeFile(%s) error: %w", newFn, err)
	}

	if err := sys.remove(oldFn); err != nil {
		return nil, xerrors.Errorf("remove(%s) error: %w", oldFn, err)
	}

	return []string{oldFn, newFn}, nil
}
