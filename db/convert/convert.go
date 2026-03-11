package convert

import (
	"binder/db/convert/core"
	"log/slog"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

// Converter は core.Converter の再エクスポート。
// 呼び出し元が binder/db/convert/core を直接インポートしなくて済むようにする。
type Converter = core.Converter

// Apply はCSVコンバーターを順番に適用する。
// バージョンチェックは呼び出し元（binder/convert）で行い、
// 適用すべきコンバーターのリストをここに渡す。
func Apply(p string, converters []Converter) error {

	if len(converters) == 0 {
		return nil
	}

	// p ディレクトリ内の全CSVファイルを FileSet として収集
	var files []*core.FileSet
	matches, err := filepath.Glob(filepath.Join(p, "*.csv"))
	if err != nil {
		return xerrors.Errorf("filepath.Glob() error: %w", err)
	}

	for _, f := range matches {
		fn := filepath.Base(f)
		files = append(files, core.NewFileSet(fn))
	}

	// 各コンバーターを順番に適用（FileSet を引き継ぎながらリネーム情報を蓄積）
	for _, c := range converters {
		files, err = c(p, files)
		if err != nil {
			return xerrors.Errorf("converter call error: %w", err)
		}
	}

	// FileSet の最終状態に従ってファイルをリネーム・削除
	return execFileSet(p, files)
}

// execFileSet は FileSet の Dst/Org マッピングに従い、
// db ディレクトリ内のファイルをリネームし、不要なファイルを削除する。
func execFileSet(p string, fset []*core.FileSet) error {

	files := make(map[string]string)
	for _, fs := range fset {
		files[fs.Dst] = fs.Org
	}

	entries, err := os.ReadDir(p)
	if err != nil {
		return xerrors.Errorf("os.ReadDir() error: %w", err)
	}

	// FileSet に含まれないファイルを削除（schema.version など）
	for _, entry := range entries {

		n := entry.Name()
		_, ok := files[n]

		if !ok {
			f := filepath.Join(p, n)
			err = os.Remove(f)
			if err != nil {
				return xerrors.Errorf("os.Remove() error: %w", err)
			}
		}
	}

	// 中間ファイル名（例: notes020.csv）を本来のファイル名（notes.csv）に戻す
	for key, val := range files {

		if key == val {
			continue
		}

		nf := filepath.Join(p, key)
		df := filepath.Join(p, val)

		_, err = os.Stat(nf)
		if err != nil {
			// ソースファイルが存在しない場合、既にリネーム済みの可能性
			_, err2 := os.Stat(df)
			if err2 == nil {
				// 宛先が既に存在 → 前回の実行でリネーム済み、スキップ
				slog.Warn("Already renamed: " + df)
				continue
			}
			slog.Warn("Not Found:" + err.Error())
		}
		_, err = os.Stat(df)
		if err == nil {
			slog.Warn("Found:" + df)
		}

		err = os.Rename(nf, df)
		if err != nil {
			return xerrors.Errorf("os.Rename() error: %w", err)
		}
	}

	return nil
}
