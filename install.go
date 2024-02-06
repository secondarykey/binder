package binder

import (
	"binder/db"
	"binder/fs"
	"binder/settings"
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

	err := checkDirectory(dir, true)
	if err != nil {
		return xerrors.Errorf("checkDirectory() error: %w", err)
	}

	//指定位置ににGitを作成
	b, err := fs.New(dir)
	if err != nil {
		return xerrors.Errorf("fs.New() error: %w", err)
	}

	return install(b, dir, name, sample)
}

func install(b *fs.FileSystem, dir string, name string, sample bool) error {

	//空でもディレクトリは作っておく
	docsdir := filepath.Join(dir, "docs")
	err := os.MkdirAll(docsdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(docs) error: %w", err)
	}

	datadir := filepath.Join(dir, "data")
	err = os.MkdirAll(datadir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(data) error: %w", err)
	}

	notesdir := filepath.Join(dir, "notes")
	err = os.MkdirAll(notesdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(notes) error: %w", err)
	}

	//データベースを作成
	dbdir := filepath.Join(dir, "db")
	err = os.MkdirAll(dbdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir() error: %w", err)
	}

	err = db.Create(dbdir)
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

	err = b.Add("db/config.csv", "db/notes.csv", "db/data.csv")
	if err != nil {
		return xerrors.Errorf("Add() error: %w", err)
	}

	err = b.CommitAll(fs.M("install", "Database"))
	if err != nil {
		return xerrors.Errorf("CommitAll() error: %w", err)
	}

	//空のテンプレートファイルを作成
	err = b.CreateTemplateFiles()
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

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

	err = b.CommitAll(fs.M("install", "Templates"))
	if err != nil {
		return xerrors.Errorf("CommitAll() error: %w", err)
	}

	if sample {
		//sample内から作成を行う
		//ノートとデータを作成する
		//assets登録を行う
	}

	s := settings.Get()
	err = b.Branch(s.Git.Branch)
	if err != nil {
		return xerrors.Errorf("fs.Branch() error: %w", err)
	}

	return nil
}

// install true 時すでに存在する場合、エラー
// install false 時存在しない場合エラー
func checkDirectory(dir string, install bool) error {

	dirs := []string{"db", "docs", "templates", "data", "notes"}

	for _, n := range dirs {
		target := filepath.Join(dir, n)
		_, err := os.Stat(target)
		if install && err == nil {
			return xerrors.Errorf("already exists[%s]", target)
		} else if !install && err != nil {
			return xerrors.Errorf("nothing [%s]", target)
		}
	}

	return nil
}
