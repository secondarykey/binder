package fsconvert

import (
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// MigrateV047 は0.4.7への移行でdocsディレクトリ内の全コンテンツを削除する。
// publish_date がstructuresに移動したことにより公開済みコンテンツのメタデータが
// 変わるため、docsを全てクリアして再公開が必要な状態にする。
// docsディレクトリが存在しない場合は何もしない。
func MigrateV047(dir string) error {

	docsDir := filepath.Join(dir, "docs")

	entries, err := os.ReadDir(docsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return xerrors.Errorf("os.ReadDir(docs) error: %w", err)
	}

	for _, entry := range entries {
		path := filepath.Join(docsDir, entry.Name())
		if err := os.RemoveAll(path); err != nil {
			return xerrors.Errorf("os.RemoveAll(%s) error: %w", path, err)
		}
	}

	return nil
}
