package binder

import (
	"binder/db"
	"binder/fs"
	"embed"
	stdFs "io/fs"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

//go:embed _assets
var embFs embed.FS

// 渡されたパスをBinderに設定する
// ディレクトリが存在する場合は行えない
// サンプルとしていくつかデータを作成する
func Install(dir string, name string, sample bool) error {

	err := checkDirectory(dir)
	if err != nil {
		return xerrors.Errorf("checkDirectory() error: %w", err)
	}

	//指定位置ににGitを作成
	b, err := fs.New(dir)
	if err != nil {
		return xerrors.Errorf("fs.New() error: %w", err)
	}

	dbdir := filepath.Join(dir, "db")
	os.Mkdir(dbdir, 0666)

	//データベースを作成
	err = db.Create(dbdir)
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

	//空のテンプレートファイルを作成
	err = b.CreateTemplateFiles()
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

	//TODO ここでコミット

	tempFs, err := stdFs.Sub(embFs, "_assets/templates/"+name)
	if err != nil {
		return xerrors.Errorf("template fs Sub() error: %w", err)
	}

	//全テンプレートを設定
	for _, f := range []string{"layout", "index", "list", "note"} {
		data, err := stdFs.ReadFile(tempFs, f+".tmpl")
		if err != nil {
			return xerrors.Errorf("fs ReadFile() error: %w", err)
		}
		err = b.WriteTemplate(f, data)
		if err != nil {
			return xerrors.Errorf("WriteTemplate(%s) error: %w", f, err)
		}
	}

	//コミット
	if sample {
		//sample内から作成を行う
		//ノートとデータを作成する
		//assets登録を行う
	}

	return nil
}

func checkDirectory(dir string) error {

	dirs := []string{"db", "docs", "templates", "data", "notes"}
	for _, n := range dirs {
		target := filepath.Join(dir, n)
		_, err := os.Stat(target)
		if err == nil {
			return xerrors.Errorf("already exists[%s]", target)
		}
	}
	return nil
}
