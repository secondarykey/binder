package convert

import (
	"binder/db"
	convert010 "binder/db/convert/010"
	"binder/db/convert/core"
	"os"

	"binder/db/model"
	"binder/log"
	"log/slog"
	"path/filepath"

	"golang.org/x/xerrors"
)

var v010 *model.Version

func init() {
	var err error
	v010, err = model.NewVersion("0.1.0")
	if err != nil {
		log.PrintStackTrace(err)
	}
}

func check(ov, nv *model.Version) ([]core.Converter, error) {

	var c []core.Converter
	//現在のバージョンを取得
	//新しいのバージョンのスキーマを取得
	if ov.Lt(v010) {
		c = append(c, convert010.Convert010)
	}

	return c, nil
}

// 新バージョンはアプリから取得
func Run(p string, v *model.Version) (string, error) {

	if v == nil {
		slog.Info("convert.Run() is not run(version is nil)")
		return "", nil
	}

	//DB のパスからバージョンを取得
	ov, err := db.SchemaVersion(p)
	if err != nil {
		return "", xerrors.Errorf("db.SchemaVersion() error: %w", err)
	}

	converter, err := check(ov, v)
	if err != nil {
		return "", xerrors.Errorf("check() error: %w", err)
	} else if len(converter) == 0 {
		return "", nil
	}

	if len(converter) <= 0 {
		return "", nil
	}

	//p の位置の全CSVファイルを取得
	var files []*core.FileSet
	matches, err := filepath.Glob(filepath.Join(p, "*.csv"))
	if err != nil {
		return "", xerrors.Errorf("filepath.Glob() error: %w", err)
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
			return "", xerrors.Errorf("converter call error: %w", err)
		}
	}

	nf, err := convert(p, v, files)
	if err != nil {
		return "", xerrors.Errorf("convert() error: %w", err)
	}

	return nf, nil
}

func convert(p string, v *model.Version, fset []*core.FileSet) (string, error) {

	files := make(map[string]string)
	for _, fs := range fset {
		files[fs.Dst] = fs.Org
	}

	entries, err := os.ReadDir(p)
	if err != nil {
		return "", xerrors.Errorf("os.ReadDir() error: %w", err)
	}

	//他のファイルを削除
	for _, entry := range entries {

		n := entry.Name()
		_, ok := files[n]

		if !ok {
			f := filepath.Join(p, n)
			err = os.Remove(f)
			if err != nil {
				return "", xerrors.Errorf("os.Remove() error: %w", err)
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
			slog.Warn("Not Found:" + err.Error())
		}
		_, err = os.Stat(df)
		if err == nil {
			slog.Warn("Found:" + err.Error())
		}

		err = os.Rename(nf, df)
		if err != nil {
			return "", xerrors.Errorf("os.Rename() error: %w", err)
		}
	}

	//新しいスキーマバージョンを設定
	nf, err := db.CreateSchemaFile(p, v)
	if err != nil {
		return "", xerrors.Errorf("db.CreateSchemaFile() error: %w", err)
	}
	return nf, nil
}
