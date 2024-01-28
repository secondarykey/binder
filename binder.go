package binder

import (
	"binder/db"
	"binder/db/model"
	"binder/fs"
	"binder/settings"
	"fmt"
	"net/http"

	"golang.org/x/xerrors"
)

type Binder struct {
	fileSystem        *fs.FileSystem
	db                *db.Instance
	httpServer        *http.Server
	httpServerAddress string
}

func New(path string) (*Binder, error) {

	//ファイルシステムのインスタンス
	//DB のインスタンス

	return nil, nil
}

// 渡されたパスをBinderに設定する
// ディレクトリが存在する場合は行えない
// サンプルとしていくつかデータを作成する
func Install(dir string) error {

	//あくまで作成をやって最終的にLoadすること
	_, err := fs.Create(dir)
	if err != nil {
		return xerrors.Errorf("fs.Create() error: %w", err)
	}

	//デフォルト用のデータ等をコピー

	//コンフィグを変更
	//err := b.UpdateConfig()

	//データ作成
	//d1,err := b.CreateDatum("sample")
	//d1.Set()
	//データコンパイル
	//d.Compile()

	//sample ノートを作成
	//n,err := b.CreateNote("sample")

	//ノートのデータ作成
	//d2,err := n.CreateDatum("sample")
	//d2.Set()
	//データコンパイル
	//d.Compile()

	//ノートに内容を設定
	//n.Set()
	//ノートコンパイル
	//n.Compile()

	/*
		err = GenerateIndexHTML(b)
		if err != nil {
			return xerrors.Errorf("GenerateIndexHTML() error: %w", err)
		}
	*/

	return nil
}

func Load(dir string) (*Binder, error) {

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, err
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

	err := b.fileSystem.Close()
	if err != nil {
		return xerrors.Errorf("fs.Close() error: %w", err)
	}

	err = b.httpServer.Close()
	if err != nil {
		return xerrors.Errorf("http.Close() error: %w", err)
	}

	err = b.db.Close()
	if err != nil {
		return xerrors.Errorf("db.Close() error: %w", err)
	}

	return nil
}

func (b *Binder) EditConfig(conf *model.Config) error {
	org, err := b.db.GetConfig()
	if err != nil {
		return xerrors.Errorf("db.GetConfig() error: %w", err)
	}
	conf.Created = org.Created

	err = b.db.UpdateConfig(conf)
	if err != nil {
		return xerrors.Errorf("db.UpdateConfig() error: %w", err)
	}
	return nil
}

func (b *Binder) GetConfig() (*model.Config, error) {
	return b.db.GetConfig()
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
		//保存
		err = b.fileSystem.GenerateHTML(noteId, []byte(html))
		if err != nil {
			return xerrors.Errorf("GenerateHTML() error: %w", err)
		}

		err = b.GenerateIndexHTML()
		if err != nil {
			return xerrors.Errorf("GenerateIndexHTML() error: %w", err)
		}

	} else {

		//ファイルを作成
		err := b.fileSystem.GenerateData(dataId, noteId, []byte(elm))
		if err != nil {
			return xerrors.Errorf("GenerateData() error: %w", err)
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
