package convert

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// MigrateV048 はメタファイルのパスを変更する（スキーマ 0.4.8）。
// assets/{noteId}-meta → assets/meta/{noteId}
func MigrateV048(dir string) error {
	assetsDir := filepath.Join(dir, "assets")
	metaDir := filepath.Join(assetsDir, "meta")

	entries, err := os.ReadDir(assetsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return xerrors.Errorf("os.ReadDir(%s) error: %w", assetsDir, err)
	}

	var metaFiles []os.DirEntry
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), "-meta") {
			metaFiles = append(metaFiles, entry)
		}
	}

	if len(metaFiles) == 0 {
		return nil
	}

	if err := os.MkdirAll(metaDir, 0755); err != nil {
		return xerrors.Errorf("os.MkdirAll(%s) error: %w", metaDir, err)
	}

	for _, entry := range metaFiles {
		name := entry.Name()
		noteId := strings.TrimSuffix(name, "-meta")
		src := filepath.Join(assetsDir, name)
		dst := filepath.Join(metaDir, noteId)

		slog.Info("migrate meta file", "src", src, "dst", dst)
		if err := os.Rename(src, dst); err != nil {
			return xerrors.Errorf("os.Rename(%s→%s) error: %w", src, dst, err)
		}
	}

	return nil
}
