package binder

import (
	"binder/db"
	"binder/db/model"
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

type Resource struct {
	Notes []*model.Note  `json:"notes"`
	Data  []*model.Datum `json:"data"`
}

func (b *Binder) CreateResource() (*Resource, error) {

	data, err := b.db.FindData()
	if err != nil {
		return nil, xerrors.Errorf("db.FindData() error: %w", err)
	}

	//TODO 多い場合の表示を考える
	notes, err := b.db.FindUpdatedNotes(-1, -1)
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	noteMap := make(map[string]*model.Note)
	for _, n := range notes {
		noteMap[n.ID] = n
	}

	var r Resource
	//ノートのデータをノートに入れ込む
	rootData := make([]*model.Datum, 0, len(data))

	for _, d := range data {
		n, ok := noteMap[d.NoteId]
		if ok {
			d.SetParent(n)
		} else {
			rootData = append(rootData, d)
		}
	}

	r.Notes = notes
	r.Data = rootData
	return &r, nil
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
			//DBの作成日を更新
			err = b.db.PublishNote(noteId)
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
		index, err := b.fileSystem.GenerateData(dataId, noteId, []byte(elm))
		if err != nil {
			return xerrors.Errorf("GenerateData() error: %w", err)
		}

		if index {
			err = b.db.PublishDatum(dataId, noteId)
			if err != nil {
				return xerrors.Errorf("PublishData() error: %w", err)
			}
		}
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
		f = fs.DataTextFile(dataId, noteId)
		d, err := b.GetData(dataId, noteId)
		if err != nil {
			return xerrors.Errorf("GetData() error: %w", err)
		}
		name = d.Name
	}

	if auto {
		m := fmt.Sprintf("auto save : %s %s", t, name)
		err = b.fileSystem.AutoCommit(m, f)
	} else {
		m := fmt.Sprintf("save      : %s %s", t, name)
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
