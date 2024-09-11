package binder

import (
	"binder/db"
	"binder/fs"
	"binder/settings"
	"context"
	"fmt"
	"log"
	"net/http"

	"golang.org/x/xerrors"
)

type Binder struct {
	fileSystem        *fs.FileSystem
	db                *db.Instance
	httpServer        *http.Server
	httpServerAddress string
	op                db.Op
}

type userOp struct {
	id string
}

func (op userOp) GetOperationId() string {
	return op.id
}

func createUserOp(userId string) db.Op {
	var op userOp
	op.id = userId
	return op
}

func CreateRemote(url, dir string) error {

	f, err := fs.Clone(dir, url)
	if err != nil {
		return xerrors.Errorf("fs.Clone() error: %w", err)
	}

	//TODO ブランチがリモートに存在する場合の確認方法

	//ファイルシステムをチェック
	err = checkDirectory(dir, false)
	if err != nil {
		//インストール処理を行う
		err := install(f, dir, "simple", false)
		if err != nil {
			return xerrors.Errorf("binder.install() error: %w", err)
		}
	} else {
		//ブランチの切替(install時は切り替わっている)
		s := settings.Get()
		err = f.Branch(s.Git.Branch)
		if err != nil {
			return xerrors.Errorf("fs.Branch() error: %w", err)
		}
	}

	return nil
}

func Load(dir string) (*Binder, error) {

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.Load() error: %w", err)
	}

	s := settings.Get()
	//ブランチを切り替え
	err = bfs.Branch(s.Git.Branch)
	if err != nil {
		return nil, xerrors.Errorf("Branch -> %s error: %w", s.Git.Branch, err)
	}

	err = checkDirectory(dir, false)
	if err != nil {
		return nil, xerrors.Errorf("checkDirectory() error: %w", err)
	}

	inst, err := db.New(dir + "/db")
	if err != nil {
		return nil, xerrors.Errorf("db.New() error: %w", err)
	}
	err = inst.Open()
	if err != nil {
		return nil, xerrors.Errorf("db.Open() error: %w", err)
	}

	var b Binder
	b.fileSystem = bfs
	b.db = inst
	b.op = createUserOp("user")

	err = b.Serve()
	if err != nil {
		return nil, xerrors.Errorf("db.Serve() error: %w", err)
	}

	return &b, nil
}

func (b *Binder) Close() error {

	var rtnErr error

	fp := b.fileSystem
	hp := b.httpServer
	dp := b.db

	b.fileSystem = nil
	b.httpServer = nil
	b.db = nil
	b.op = nil

	err := fp.Close()
	if err != nil {
		log.Println(err)
		rtnErr = xerrors.Errorf("fs.Close() error: %w", err)
	}

	err = hp.Shutdown(context.Background())
	if err != nil {
		log.Println(err)
		rtnErr = xerrors.Errorf("http.Close() error: %w", err)
	}

	err = dp.Close()
	if err != nil {
		log.Println(err)
		rtnErr = xerrors.Errorf("db.Close() error: %w", err)
	}

	return rtnErr
}

func (b *Binder) Generate(noteId string, dataId string, elm string) error {

	if dataId == "" {

		err := b.fileSystem.TemplatesCommit()
		if err != nil {
			return xerrors.Errorf("TemplatesCommit() error: %w", err)
		}

		//ノートのHTMLを作成
		html, err := b.CreateNoteHTML(noteId, false, elm)
		if err != nil {
			return xerrors.Errorf("CreateNoteHTML() error: %w", err)
		}

		//ファイルの作成
		flag, err := b.fileSystem.GenerateHTML(noteId, []byte(html))
		if err != nil {
			return xerrors.Errorf("GenerateHTML() error: %w", err)
		}

		//新規登録の場合
		if flag {
			//DBの公開日を更新
			err = b.db.PublishNote(noteId, b.op)
			if err != nil {
				return xerrors.Errorf("PublishNote() error: %w", err)
			}
		}

		//index,listの作成
		err = b.GenerateIndexHTML()
		if err != nil {
			return xerrors.Errorf("GenerateIndexHTML() error: %w", err)
		}

	} else {

		//ファイルを作成
		index, err := b.fileSystem.GenerateDiagram(dataId, []byte(elm))
		if err != nil {
			return xerrors.Errorf("GenerateData() error: %w", err)
		}

		if index {
			err = b.db.PublishDiagram(dataId, b.op)
			if err != nil {
				return xerrors.Errorf("PublishData() error: %w", err)
			}
		}

		//TODO 出力データのコミット

	}
	return nil
}

func (b *Binder) SaveCommit(noteId string, dataId string, auto bool) error {

	var err error
	t := ""
	name := "nothing"
	f := ""

	if dataId == "" {

		t = "Note"
		f = fs.NoteTextFile(noteId)

		n, err := b.GetNote(noteId)
		if err != nil {
			return xerrors.Errorf("GetNote() error: %w", err)
		}

		name = n.Name
	} else {

		t = "Data"
		f = fs.DiagramTextFile(dataId)

		d, err := b.GetDiagram(dataId)
		if err != nil {
			return xerrors.Errorf("GetDiagram() error: %w", err)
		}
		name = d.Name
	}

	if auto {
		m := fs.M("auto save", fmt.Sprintf("%s %s", t, name))
		err = b.fileSystem.AutoCommit(m, f)
	} else {
		m := fs.M("save", fmt.Sprintf("%s %s", t, name))
		err = b.fileSystem.Commit(m, f)
	}

	if err != nil {
		return xerrors.Errorf("fs.Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) SaveSetting(s *settings.Setting) error {

	org := settings.Get()

	//Positionはそのまま
	org.Path.Default = s.Path.Default
	org.Path.RunWithOpen = s.Path.RunWithOpen
	org.Path.OpenWithItem = s.Path.OpenWithItem

	org.Git.Branch = s.Git.Branch
	org.Git.Name = s.Git.Name
	org.Git.Mail = s.Git.Mail
	org.Git.Code = s.Git.Code

	//org.Look

	err := org.Save()
	if err != nil {
		return xerrors.Errorf("settings.Save() error: %w", err)
	}
	return nil
}

func (b *Binder) GetRemotes() ([]string, error) {

	configs, err := b.fileSystem.GetRemotes()
	if err != nil {
		return nil, xerrors.Errorf("fs.GetRemotes() error: %w", err)
	}

	names := make([]string, len(configs))
	for idx, c := range configs {
		names[idx] = c.Name
	}
	return names, nil
}

func (b *Binder) CreateRemote(name, url string) error {
	err := b.fileSystem.CreateRemote(name, url)
	if err != nil {
		return xerrors.Errorf("CreateRemote() error: %w", err)
	}
	return nil
}
