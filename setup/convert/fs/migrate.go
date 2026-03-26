package fsconvert

import (
	"binder/log"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// MigrateV022 はアセットのディレクトリ階層構造をフラット化する（スキーマ 0.2.2）。
// プライベートアセット: assets/{parentId}/{assetId} → assets/{assetId}
// メタファイル:         assets/{noteId}/meta        → assets/{noteId}-meta
// 公開アセット:         docs/assets/{noteAlias}/{assetAlias} → docs/assets/{assetAlias}
// 公開メタファイル:     docs/assets/{noteAlias}/meta         → docs/assets/{noteAlias}-meta
func MigrateV022(dir string) error {

	// プライベートアセットの移行
	privateAssets := filepath.Join(dir, "assets")
	if err := flattenAssetDir(privateAssets); err != nil {
		return xerrors.Errorf("flattenAssetDir(assets) error: %w", err)
	}

	// 公開アセットの移行
	publicAssets := filepath.Join(dir, "docs", "assets")
	if err := flattenAssetDir(publicAssets); err != nil {
		return xerrors.Errorf("flattenAssetDir(docs/assets) error: %w", err)
	}

	return nil
}

// flattenAssetDir はアセットディレクトリ内のサブディレクトリを検出し、
// その中のファイルを親ディレクトリへフラット移動する。
// ファイル名が "meta" の場合は "{parentDirName}-meta" にリネームする。
func flattenAssetDir(assetsDir string) error {

	entries, err := os.ReadDir(assetsDir)
	if err != nil {
		if os.IsNotExist(err) {
			// ディレクトリが存在しない場合は移行不要
			return nil
		}
		return xerrors.Errorf("os.ReadDir(%s) error: %w", assetsDir, err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			// 通常ファイルは既にフラット、スキップ
			continue
		}

		parentName := entry.Name()
		parentDir := filepath.Join(assetsDir, parentName)

		files, err := os.ReadDir(parentDir)
		if err != nil {
			return xerrors.Errorf("os.ReadDir(%s) error: %w", parentDir, err)
		}

		for _, f := range files {
			if f.IsDir() {
				continue
			}

			src := filepath.Join(parentDir, f.Name())

			var dst string
			if f.Name() == "meta" {
				// メタファイルは "{parentDirName}-meta" にリネーム
				dst = filepath.Join(assetsDir, parentName+"-meta")
			} else {
				// 通常アセットはファイル名（ID）をそのままフラットへ移動
				dst = filepath.Join(assetsDir, f.Name())
			}

			log.Info("migrate asset src=" + src + " dst=" + dst)
			if err := os.Rename(src, dst); err != nil {
				return xerrors.Errorf("os.Rename(%s→%s) error: %w", src, dst, err)
			}
		}

		// 空になったサブディレクトリを削除
		if err := os.Remove(parentDir); err != nil {
			// 削除できなくても致命的ではない（警告のみ）
			log.WarnE("Could not remove directory after migration dir="+parentDir, err)
		}
	}

	return nil
}
