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

const (
	PageTemplate    = "{{ define Pages }}"
	ContentTemplate = "{{ define Content }}"
	EndTemplate     = "{{ end }}"
)

type wrapper struct {
	owner *fs.Binder
	gen   bool
}

func (w wrapper) latestNotes(n int) []*model.Note {
	//Binderを含めておいて、Binder内の最新のn件を設定
	return make([]*model.Note, 0)
}

func defineFuncMap(b *fs.Binder, gen bool) map[string]interface{} {
	w := wrapper{b, gen}
	funcMap := map[string]interface{}{
		"replace":     strings.ReplaceAll,
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

func writeHTML(w io.Writer, b *fs.Binder, file bool, t string, elm string) error {

	tName := ""
	home := "./"
	assets := "assets"

	if t != "index" && t != "list" {
		tName += "note.tmpl"
		assets := "../assets"
		home = "../"
	} else {
		tName += t + ".tmpl"
	}

	//FuncMapを準備
	tmpl := template.New("Pages").Funcs(template.FuncMap(defineFuncMap(b, file)))
	//layout と typeでパース
	tmpl, err := tmpl.ParseFS(b, "templates/layout.tmpl", "templates/"+tName)
	if err != nil {
		return xerrors.Errorf("tmpl.ParseFS() error: %w", err)
	}

	if !file {
		assets = fmt.Sprintf("http://%s/%s", b.ServerAddress(), assets)
	}

	//ノートの時はRootが変更になるイメージ
	//実際の出力、メモリ上の出力
	dto := struct {
		Home        string
		Name        string
		Description string
		DataRoot    string
		Marked      template.HTML
	}{home, "Binder sample", "Binder Description", assets, template.HTML(elm)}

	//出力
	err = tmpl.Execute(w, dto)
	if err != nil {
		return xerrors.Errorf("tmpl Execute() error: %w", err)
	}

	return nil
}
