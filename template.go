package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"
	"strings"

	"html/template"
	"io"

	"golang.org/x/xerrors"
)

func isNote(id string) bool {
	if id == "index" || id == "list" || id == "layout" {
		return false
	}
	return true
}

type wrapper struct {
	owner *Binder
	local bool
	id    string
}

func newWrapper(o *Binder, local bool, id string) *wrapper {
	var w wrapper
	w.owner = o
	w.local = local
	w.id = id

	return &w
}

func (w wrapper) dir() string {

	assets := "assets"
	if w.local {
		assets = fmt.Sprintf("http://%s/%s", w.owner.ServerAddress(), "assets")
	} else if isNote(w.id) {
		assets = "../" + assets
	}
	return assets
}

func (w wrapper) assets(id string) string {
	return w.dir() + "/" + id
}

func (w wrapper) latestNotes(n int) []*model.Note {
	//Binderを含めておいて、Binder内の最新のn件を設定
	return make([]*model.Note, 0)
}

func defineFuncMap(b *Binder, local bool, id string) map[string]interface{} {
	w := newWrapper(b, local, id)
	funcMap := map[string]interface{}{
		"replace":     strings.ReplaceAll,
		"assets":      w.assets,
		"latestNotes": w.latestNotes,
		"lf2br":       convertLF2BR,
		"lf2sp":       convertLF2SP,
		"lf2comma":    convertLF2Comma,
	}
	return funcMap
}

func convertLF2BR(src string) string {
	return strings.ReplaceAll(src, "\n", "<br/>")
}

func convertLF2SP(src string) string {
	return strings.ReplaceAll(src, "\n", " ")
}

func convertLF2Comma(src string) string {
	return strings.ReplaceAll(src, "\n", ",")
}

func (b *Binder) createTemplate(local bool, id string, text string) (*template.Template, error) {

	var err error
	//FuncMapを準備
	tmpl := template.New(fs.TemplatePageRoot).Funcs(template.FuncMap(defineFuncMap(b, local, id)))

	if id == "layout" && text != "" {
		//レイアウトをテキストで代用
		_, err = tmpl.Parse(b.fileSystem.AddTemplateFrame(id, text))
		if err != nil {
			return nil, xerrors.Errorf("layout Parse() error: %w", err)
		}
	} else {
		layoutFile := fs.TemplateFileName("layout")
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, layoutFile)
		if err != nil {
			return nil, xerrors.Errorf("layout ParseFS([%s]) error: %w", layoutFile, err)
		}
	}

	if id != "layout" && text != "" {
		_, err = tmpl.Parse(b.fileSystem.AddTemplateFrame(id, text))
		if err != nil {
			return nil, xerrors.Errorf("Parse() error: %w", id, err)
		}
	} else {
		tId := id
		if id != "index" && id != "list" {
			tId = "note"
		}
		tmpFile := fs.TemplateFileName(tId)
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, tmpFile)
		if err != nil {
			return nil, xerrors.Errorf("[%s] Parse() error: %w", id, err)
		}
	}

	return tmpl, nil
}

func (b *Binder) writeHTML(w io.Writer, tmpl *template.Template, elm string) error {

	dto := struct {
		Name        string
		Description string
		Marked      template.HTML
	}{"Binder Name", "Binder Desctiprtion", template.HTML(elm)}

	//出力
	err := tmpl.Execute(w, dto)
	if err != nil {
		return xerrors.Errorf("tmpl Execute() error: %w", err)
	}
	return nil
}

func (b *Binder) OpenTemplate(id string) ([]byte, error) {
	return b.fileSystem.ReadTemplate(id)
}

func (b *Binder) SaveTemplate(id string, data string) error {

	//TODO []byteにできないか考える
	//枠を作成
	txt := b.fileSystem.AddTemplateFrame(id, data)
	err := b.fileSystem.WriteTemplate(id, []byte(txt))
	if err != nil {
		return xerrors.Errorf("WriteTemplate() error: %w", err)
	}

	return nil
}

// リストも一緒に出力
func (b *Binder) GenerateIndexHTML() error {

	err := b.generateHTML("index", 0)
	if err != nil {
		return xerrors.Errorf("generateHTML(index) error: %w", err)
	}

	//list_n.htmlをすべて削除する

	//ページ数を換算する
	idx := 0
	err = b.generateHTML("list", idx+1)
	if err != nil {
		return xerrors.Errorf("generateHTML(list) error: %w", err)
	}
	return nil
}

// HTMLファイル出力用
func (b *Binder) generateHTML(id string, idx int) error {

	n := ""
	if id == "index" {
		n = fs.IndexHTML()
	} else {
		n = fs.ListHTML(idx)
	}

	fp, err := b.fileSystem.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}

	tmpl, err := b.createTemplate(false, id, "")
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}

	err = b.writeHTML(fp.(io.Writer), tmpl, "")
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}

	err = b.fileSystem.Commit("generate:" + id)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// HTMLメモリ作成
func (b *Binder) CreateNoteHTML(id string, local bool, elm string) (string, error) {

	tmpl, err := b.createTemplate(local, id, "")
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, elm)
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}
	return builder.String(), nil
}

func (b *Binder) CreateTemplateHTML(id string, temp string, elm string) (string, error) {

	tmpl, err := b.createTemplate(true, id, temp)
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, elm)
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}

	return builder.String(), nil
}
