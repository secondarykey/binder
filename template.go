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
	owner *fs.Binder
	local bool
	id    string
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

func defineFuncMap(b *fs.Binder, local bool, id string) map[string]interface{} {
	w := wrapper{b, local, id}
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

func createTemplate(b *fs.Binder, local bool, id string, text string) (*template.Template, error) {

	var err error
	//FuncMapを準備
	tmpl := template.New(fs.TemplatePageRoot).Funcs(template.FuncMap(defineFuncMap(b, local, id)))

	if id == "layout" && text != "" {
		//レイアウトをテキストで代用
		_, err = tmpl.Parse(b.AddTemplateFrame(id, text))
		if err != nil {
			return nil, xerrors.Errorf("layout Parse() error: %w", err)
		}
	} else {
		layoutFile := fs.TemplateFileName("layout")
		//layout と typeでパース
		_, err = tmpl.ParseFS(b, layoutFile)
		if err != nil {
			return nil, xerrors.Errorf("layout ParseFS([%s]) error: %w", layoutFile, err)
		}
	}

	if id != "layout" && text != "" {
		_, err = tmpl.Parse(b.AddTemplateFrame(id, text))
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
		_, err = tmpl.ParseFS(b, tmpFile)
		if err != nil {
			return nil, xerrors.Errorf("[%s] Parse() error: %w", id, err)
		}
	}

	return tmpl, nil
}

//Index,,,Home?

//Note - 自分の場合
//  Name
//  Detail
//  pageImage
//  Link

//Prev 次のページの情報
//Next 前のページの情報

//Pager
//  PageNum 最大ページ数
//  Now 今のページ数
//  First
//  Last

func writeHTML(w io.Writer, b *fs.Binder, tmpl *template.Template, elm string) error {

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
