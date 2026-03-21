package setup

import (
	"binder/db"
	"binder/fs"
	. "binder/internal"
	"binder/settings"
	"embed"
	"log/slog"
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

const (
	NoteRootId        = "index"
	TemplateLayoutId  = "layout"
	TemplateIndexId   = "index"
	TemplateContentId = "content"
)

//go:embed _assets
var embFs embed.FS

// Install は指定パスに新しいBinderを作成する。
// ディレクトリが存在しない場合は作成し、git初期化・DB作成・binder.json作成・サンプルデータ初期化を行う。
func Install(dir string, ver *Version, name string) error {

	// ディレクトリが存在しない場合は作成する
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return xerrors.Errorf("os.MkdirAll() error: %w", err)
		}
	}

	err := CheckDirectory(dir, true)
	if err != nil {
		return xerrors.Errorf("CheckDirectory() error: %w", err)
	}

	// 指定位置にGitを作成（デフォルトブランチ名で初期化）
	s := settings.Get()
	f, err := fs.NewWithBranch(dir, s.Git.Branch)
	if err != nil {
		return xerrors.Errorf("fs.NewWithBranch() error: %w", err)
	}

	err = install(f, dir, ver)
	if err != nil {
		return xerrors.Errorf("install() error: %w", err)
	}

	// サンプルデータの初期化
	inst, err := db.New(f.DatabaseDir())
	if err != nil {
		return xerrors.Errorf("db.New() error: %w", err)
	}
	err = inst.Open()
	if err != nil {
		return xerrors.Errorf("db.Open() error: %w", err)
	}
	defer inst.Close()

	err = initialize(f, inst, name)
	if err != nil {
		return xerrors.Errorf("initialize() error: %w", err)
	}

	// ユーザデータを暗号化して保存（Git設定のユーザ名・メールアドレスを初期値とする）
	key, err := GetUserKey()
	if err != nil {
		slog.Warn("Install: GetUserKey", "Error", err)
	} else {
		info := &fs.UserInfo{
			Name:  s.Git.Name,
			Email: s.Git.Mail,
		}
		if err = fs.SaveUserInfo(dir, key, info); err != nil {
			slog.Warn("Install: SaveUserInfo", "Error", err)
		}
	}

	// デフォルトブランチ上でコミット済み。作業ブランチが設定されていれば切り替え
	if s.Git.WorkBranch != "" && s.Git.WorkBranch != s.Git.Branch {
		err = f.Branch(s.Git.WorkBranch)
		if err != nil {
			return xerrors.Errorf("fs.Branch(WorkBranch) error: %w", err)
		}
	}

	return nil
}

func install(f *fs.FileSystem, dir string, ver *Version) error {

	// 空でもディレクトリは作っておく
	docsdir := filepath.Join(dir, f.GetPublic())
	err := os.MkdirAll(docsdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(docs) error: %w", err)
	}

	datadir := filepath.Join(dir, fs.DiagramDir)
	err = os.MkdirAll(datadir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(diagrams) error: %w", err)
	}

	notesdir := filepath.Join(dir, fs.NoteDir)
	err = os.MkdirAll(notesdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(notes) error: %w", err)
	}

	tempDir := filepath.Join(dir, fs.TemplateDir)
	err = os.MkdirAll(tempDir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(templates) error: %w", err)
	}

	assetdir := filepath.Join(dir, fs.AssetDir)
	err = os.MkdirAll(assetdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(assets) error: %w", err)
	}

	// データベースを作成
	dbdir := filepath.Join(dir, fs.DBDir)
	err = os.MkdirAll(dbdir, 0666)
	if err != nil {
		return xerrors.Errorf("os.Mkdir(db) error: %w", err)
	}

	err = db.Create(dbdir, ver)
	if err != nil {
		return xerrors.Errorf("db.Create() error: %w", err)
	}

	// binder.jsonをルートディレクトリに作成（0.4.5以降はname/detailも管理）
	if ver != nil {
		meta := &fs.BinderMeta{
			Version: ver.String(),
			Name:    "Binder",
		}
		err = fs.SaveMeta(dir, meta)
		if err != nil {
			return xerrors.Errorf("fs.SaveMeta() error: %w", err)
		}
	}

	// .gitignore を作成（ユーザデータファイルを除外）
	ignorePath := filepath.Join(dir, fs.GitIgnoreFile)
	err = os.WriteFile(ignorePath, []byte(fs.UserFileName+"\n"), 0644)
	if err != nil {
		return xerrors.Errorf("os.WriteFile(.gitignore) error: %w", err)
	}

	// Gitへの追加を行う
	err = f.AddDBFiles()
	if err != nil {
		return xerrors.Errorf("Add() error: %w", err)
	}

	err = f.AddFile(fs.BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("AddFile(binder.json) error: %w", err)
	}

	err = f.AddFile(fs.GitIgnoreFile)
	if err != nil {
		return xerrors.Errorf("AddFile(.gitignore) error: %w", err)
	}

	err = f.CommitAll(fs.M("Install", "Database"))
	if err != nil {
		return xerrors.Errorf("CommitAll() error: %w", err)
	}

	return nil
}

// CheckDirectory はBinderに必要なディレクトリ群の存在を確認する。
// install=true の場合、ディレクトリが既に存在するとエラー。
// install=false の場合、ディレクトリが存在しないとエラー。
func CheckDirectory(dir string, install bool) error {

	//TODO ちょっと違うかも
	dirs := []string{"db", "docs", "templates", "diagrams", "notes"}

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
