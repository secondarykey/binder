package convert

import (
	. "binder/internal"

	convert010 "binder/db/convert/010"
	convert020 "binder/db/convert/020"
	convert021 "binder/db/convert/021"
	convert022 "binder/db/convert/022"
	convert033 "binder/db/convert/033"
	"binder/db/convert/core"
	"os"

	"binder/log"
	"log/slog"
	"path/filepath"

	"golang.org/x/xerrors"
)

var v010 *Version
var v020 *Version
var v021 *Version
var v022 *Version
var v033 *Version

func init() {
	var err error
	v010, err = NewVersion("0.1.0")
	if err != nil {
		log.PrintStackTrace(err)
	}
	v020, err = NewVersion("0.2.0")
	if err != nil {
		log.PrintStackTrace(err)
	}
	v021, err = NewVersion("0.2.1")
	if err != nil {
		log.PrintStackTrace(err)
	}
	v022, err = NewVersion("0.2.2")
	if err != nil {
		log.PrintStackTrace(err)
	}
	v033, err = NewVersion("0.3.3")
	if err != nil {
		log.PrintStackTrace(err)
	}
}

func check(ov, nv *Version) ([]core.Converter, error) {

	var c []core.Converter
	//現在のバージョンを取得
	//新しいのバージョンのスキーマを取得
	if ov.Lt(v010) {
		c = append(c, convert010.Convert010)
	}
	if ov.Lt(v020) {
		c = append(c, convert020.Convert020)
	}
	if ov.Lt(v021) {
		c = append(c, convert021.Convert021)
	}
	if ov.Lt(v022) {
		c = append(c, convert022.Convert022)
	}
	if ov.Lt(v033) {
		c = append(c, convert033.Convert033)
	}

	return c, nil
}

// Run はスキーマ変換を実行する。ovは呼び出し元がbinder.jsonから取得した現在のスキーマバージョン
func Run(p string, ov *Version, v *Version) error {

	if v == nil {
		slog.Info("convert.Run() is not run(version is nil)")
		return nil
	}

	converter, err := check(ov, v)
	if err != nil {
		return xerrors.Errorf("check() error: %w", err)
	} else if len(converter) == 0 {
		return nil
	}

	if len(converter) <= 0 {
		return nil
	}

	//p の位置の全CSVファイルを取得
	var files []*core.FileSet
	matches, err := filepath.Glob(filepath.Join(p, "*.csv"))
	if err != nil {
		return xerrors.Errorf("filepath.Glob() error: %w", err)
	}

	//元ファイル名を作成
	for _, f := range matches {
		fn := filepath.Base(f)
		files = append(files, core.NewFileSet(fn))
	}

	//新しいファイル名に変更
	for _, c := range converter {
		files, err = c(p, files)
		if err != nil {
			return xerrors.Errorf("converter call error: %w", err)
		}
	}

	err = convert(p, v, files)
	if err != nil {
		return xerrors.Errorf("convert() error: %w", err)
	}

	return nil
}

func convert(p string, v *Version, fset []*core.FileSet) error {

	files := make(map[string]string)
	for _, fs := range fset {
		files[fs.Dst] = fs.Org
	}

	entries, err := os.ReadDir(p)
	if err != nil {
		return xerrors.Errorf("os.ReadDir() error: %w", err)
	}

	//他のファイルを削除
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

	//元ファイル名に戻す
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
