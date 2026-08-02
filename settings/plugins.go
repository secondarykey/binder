package settings

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/xerrors"
)

const PluginsDirName = "plugins"

func PluginsDirPath() string {
	return filepath.Join(DirPath(), PluginsDirName)
}

func DefaultPluginsDirPath() string {
	return filepath.Join(PluginsDirPath(), DefaultDirName)
}

func DefaultPluginsEngineDirPath(engine string) string {
	return filepath.Join(DefaultPluginsDirPath(), engine)
}

func PluginsEngineDirPath(engine string) string {
	return filepath.Join(PluginsDirPath(), engine)
}

// AppPluginInfo はアプリレベルプラグインの情報を保持する。
// Content は設定画面がメタデータ（@plugin-version / @marked 等）を解析するために持つ。
// 解析はフロントエンド（pluginMeta.js）で一元化しているため Go 側では解釈しない。
type AppPluginInfo struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func appPluginEngineDirPath(engine string) string {
	return filepath.Join(PluginsDirPath(), engine)
}

func appPluginFilePath(engine, name string) string {
	return filepath.Join(appPluginEngineDirPath(engine), name+".js")
}

// ListAppPlugins は ~/.binder/plugins/{engine}/ 内のプラグイン一覧を内容込みで返す。
// 読めなかったファイルは Content を空にして一覧には残す（存在自体は見せる）。
func ListAppPlugins(engine string) ([]AppPluginInfo, error) {
	dir := appPluginEngineDirPath(engine)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []AppPluginInfo{}, nil
		}
		return nil, xerrors.Errorf("ReadDir(%s) error: %w", dir, err)
	}

	var result []AppPluginInfo
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".js") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".js")
		content, err := ReadAppPlugin(engine, name)
		if err != nil {
			content = ""
		}
		result = append(result, AppPluginInfo{
			Name:    name,
			Content: content,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})
	return result, nil
}

// ReadAppPlugin は指定プラグインのJS内容を返す。
func ReadAppPlugin(engine, name string) (string, error) {
	data, err := os.ReadFile(appPluginFilePath(engine, name))
	if err != nil {
		return "", xerrors.Errorf("ReadFile(%s/%s) error: %w", engine, name, err)
	}
	return string(data), nil
}

// SaveAppPlugin はアプリプラグインを保存する（新規・上書き）。
func SaveAppPlugin(engine, name, content string) error {
	dir := appPluginEngineDirPath(engine)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("MkdirAll(%s) error: %w", dir, err)
	}
	if err := os.WriteFile(appPluginFilePath(engine, name), []byte(content), 0644); err != nil {
		return xerrors.Errorf("WriteFile(%s/%s) error: %w", engine, name, err)
	}
	return nil
}

// DeleteAppPlugin はアプリプラグインを削除する。
func DeleteAppPlugin(engine, name string) error {
	if err := os.Remove(appPluginFilePath(engine, name)); err != nil {
		return xerrors.Errorf("Remove(%s/%s) error: %w", engine, name, err)
	}
	return nil
}

// RenameAppPlugin はアプリプラグインをリネームする。
func RenameAppPlugin(engine, oldName, newName string) error {
	oldPath := appPluginFilePath(engine, oldName)
	newPath := appPluginFilePath(engine, newName)
	if _, err := os.Stat(newPath); err == nil {
		return xerrors.Errorf("plugin already exists: %s", newName)
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return xerrors.Errorf("Rename(%s -> %s) error: %w", oldName, newName, err)
	}
	return nil
}
