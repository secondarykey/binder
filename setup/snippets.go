package setup

import (
	"binder/settings"
	"embed"
	"os"

	"golang.org/x/xerrors"
)

// TODO install.go を確認
//
//go:embed _assets
var embFs embed.FS

// InstallSnippets はデフォルトの snippets.json を ~/.binder/snippets.json に配置する。
// ファイルが既に存在する場合はスキップする（ユーザーの編集を上書きしない）。
func InstallSnippets() error {

	//TODO パスを持っていておかしい

	dir := settings.DirPath()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	p := settings.SnippetsFilePath()
	if _, err := os.Stat(p); err == nil {
		// 既に存在する場合はスキップ
		return nil
	}

	data, err := embFs.ReadFile("_assets/snippets.json")
	if err != nil {
		return xerrors.Errorf("embFs.ReadFile() error: %w", err)
	}

	if err = os.WriteFile(p, data, 0644); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
	}

	return nil
}
