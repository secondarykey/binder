package binder

import (
	"binder/db"
	"binder/db/model"
	"binder/fs"

	"io"
	"strings"

	"golang.org/x/xerrors"
)

type Binder struct {
	fileSystem *fs.FileSystem
	instance   *db.Instance
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

func Load(dir string) (*fs.Binder, error) {
	b, err := fs.LoadBinder(dir)
	if err != nil {
		return nil, err
	}
	err = db.Open(dir + "/db")
	if err != nil {
		return nil, xerrors.Errorf("db.Open() error: %w", err)
	}
	err = b.Serve()
	if err != nil {
		return nil, xerrors.Errorf("db.Serve() error: %w", err)
	}

	return b, nil
}

type Resource struct {
	Notes []*model.Note  `json:"notes"`
	Data  []*model.Datum `json:"data"`
}

func CreateResource() (*Resource, error) {

	data, err := db.FindData()
	if err != nil {
		return nil, xerrors.Errorf("db.FindData() error: %w", err)
	}

	notes, err := db.FindNotes()
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

// リストも一緒に出力
func GenerateIndexHTML(b *fs.Binder) error {

	err := generateHTML(b, "index")
	if err != nil {
		return xerrors.Errorf("generateHTML(index) error: %w", err)
	}

	err = generateHTML(b, "list")
	if err != nil {
		return xerrors.Errorf("generateHTML(list) error: %w", err)
	}
	return nil
}

func GenerateNoteHTML(b *fs.Binder, id string) error {
	return generateHTML(b, id)
}

// HTMLファイル出力用
func generateHTML(b *fs.Binder, id string) error {

	//TODO 取得をfsから行う
	n := "docs/" + id + ".html"
	//List時はページャーを作る
	if id != "index" && id != "list" {
		dir := "docs/notes/" + id
		n = dir + "/index.html"
	}

	//list 時にループする
	fp, err := b.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}

	tmpl, err := createTemplate(b, false, id, "")
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}

	err = writeHTML(fp.(io.Writer), b, tmpl, "")
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}

	err = b.Commit("generate:" + id)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// HTMLメモリ作成
func CreateNoteHTML(b *fs.Binder, id string, elm string) (string, error) {

	tmpl, err := createTemplate(b, true, id, "")
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	var builder strings.Builder
	err = writeHTML(&builder, b, tmpl, elm)
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}
	return builder.String(), nil
}

// HTMLメモリ作成
func CreateTemplateHTML(b *fs.Binder, id string, elm string) (string, error) {

	tmpl, err := createTemplate(b, true, id, elm)
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	var builder strings.Builder
	err = writeHTML(&builder, b, tmpl, "")
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}
	return builder.String(), nil
}
