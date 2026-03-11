package binder

import (
	. "binder/internal"
	"bufio"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

var v022migrate *Version
var v045migrate *Version

func init() {
	var err error
	v022migrate, err = NewVersion("0.2.2")
	if err != nil {
		panic("v022migrate version parse error: " + err.Error())
	}
	v045migrate, err = NewVersion("0.4.5")
	if err != nil {
		panic("v045migrate version parse error: " + err.Error())
	}
}

// migrateFilesystemV022 はアセットのディレクトリ階層構造をフラット化する（スキーマ 0.2.2）。
// プライベートアセット: assets/{parentId}/{assetId} → assets/{assetId}
// メタファイル:         assets/{noteId}/meta        → assets/{noteId}-meta
// 公開アセット:         docs/assets/{noteAlias}/{assetAlias} → docs/assets/{assetAlias}
// 公開メタファイル:     docs/assets/{noteAlias}/meta         → docs/assets/{noteAlias}-meta
func migrateFilesystemV022(dir string) error {

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

			slog.Info("migrate asset", "src", src, "dst", dst)
			if err := os.Rename(src, dst); err != nil {
				return xerrors.Errorf("os.Rename(%s→%s) error: %w", src, dst, err)
			}
		}

		// 空になったサブディレクトリを削除
		if err := os.Remove(parentDir); err != nil {
			// 削除できなくても致命的ではない（警告のみ）
			slog.Warn("Could not remove directory after migration", "dir", parentDir, "err", err)
		}
	}

	return nil
}

// readConfigCSV はdb/config.csvからnameとdetailを読み込む（0.4.5移行用）。
// ファイルが存在しない場合やパースできない場合はデフォルト値を返す。
func readConfigCSV(dbDir string) (name, detail string) {
	p := filepath.Join(dbDir, "config.csv")
	fp, err := os.Open(p)
	if err != nil {
		return "Binder", ""
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)

	// ヘッダ行を読み込んでname/detailのインデックスを特定
	if !scanner.Scan() {
		return "Binder", ""
	}
	headers := strings.Split(scanner.Text(), ",")
	nameIdx, detailIdx := -1, -1
	for i, h := range headers {
		switch h {
		case "name":
			nameIdx = i
		case "detail":
			detailIdx = i
		}
	}
	if nameIdx < 0 {
		return "Binder", ""
	}

	// 最初のデータ行を読み込む
	if !scanner.Scan() {
		return "Binder", ""
	}
	cols := strings.Split(scanner.Text(), ",")

	if nameIdx < len(cols) {
		name = unescapeCSVField(cols[nameIdx])
	}
	if detailIdx >= 0 && detailIdx < len(cols) {
		detail = unescapeCSVField(cols[detailIdx])
	}

	if name == "" {
		name = "Binder"
	}
	return name, detail
}

// unescapeCSVField はcsvqのエスケープを元に戻す
func unescapeCSVField(s string) string {
	s = strings.ReplaceAll(s, "&#10;", "\n")
	s = strings.ReplaceAll(s, "&#32;", " ")
	s = strings.ReplaceAll(s, "&#34;", "\"")
	s = strings.ReplaceAll(s, "&#44;", ",")
	return s
}
