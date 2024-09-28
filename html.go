package binder

import (
	"fmt"
	"html/template"
	"io"
	"log"
	"strings"
	"time"

	"binder/db"
	"binder/db/model"
	"binder/fs"

	"golang.org/x/xerrors"
)

type tempNote struct {
	Id      string
	Name    string
	Detail  string
	Publish string
	Updated string

	Created string
	Link    string
	Image   string
}

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

type wrapper struct {
	owner *Binder
	note  *model.Note
	Local bool
}

func newWrapper(o *Binder, local bool, note *model.Note) (*wrapper, error) {
	var w wrapper
	w.owner = o
	w.Local = local
	w.note = note
	return &w, nil
}

func (w *wrapper) localAddr() string {
	return fmt.Sprintf("http://%s", w.owner.ServerAddress())
}

func (w *wrapper) assets(id string) string {
	a, err := w.owner.GetAssetWithParent(id)
	if err != nil {
		return "assets/error"
	}

	p := fs.PublicAssetFile(a)
	return w.convertURL(p)
}

func (w *wrapper) latestNotes(n int) []*tempNote {
	return w.getNotes(n, -1)
}

func (w *wrapper) getNotes(limit int, offset int) []*tempNote {

	var err error
	var notes []*model.Note
	if w.Local {
		notes, err = w.owner.db.FindUpdatedNotes(limit, offset)
	} else {
		notes, err = w.owner.db.FindPublishNotes(limit, offset)
	}

	rtn := make([]*tempNote, len(notes))
	if err != nil {
		log.Println(err)
		return rtn
	}

	for idx, n := range notes {
		rtn[idx] = w.convertNote(n)
	}
	return rtn
}

func (w *wrapper) convertNote(n *model.Note) *tempNote {

	var t tempNote

	t.Id = n.Id
	t.Name = n.Name
	t.Detail = n.Detail
	t.Publish = formatTime(n.Publish)
	t.Created = formatTime(n.Created)
	t.Updated = formatTime(w.getUpdatedNoteFile(n))

	p := fs.HTMLFile(n)
	m := fs.PublicMetaFile(n)
	t.Link = w.convertURL(p)
	t.Image = w.convertURL(m)

	return &t
}

func (w *wrapper) getUpdatedNoteFile(n *model.Note) time.Time {
	info, err := w.owner.fileSystem.Stat(fs.HTMLFile(n))
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

func (w *wrapper) getCurrentNote() *tempNote {
	if w.note == nil {
		return nil
	}
	return w.convertNote(w.note)
}

// 取得してきたパスからURL変換
func (w *wrapper) convertURL(p string) string {
	np := strings.ReplaceAll(p, "\\", "/")
	cp := w.owner.fileSystem.GetPublic() + "/"
	return strings.Replace(np, cp, "", 1)
}

func (w *wrapper) drawSVG(id string) template.HTML {

	code := ""
	if w.Local {
		txt, err := w.owner.OpenDiagram(id)
		if err != nil {
			return template.HTML(err.Error())
		}
		code = string(txt)
	} else {
		f := w.getSVGFile(id)
		code = fmt.Sprintf(`<img src="%s">`, f)
	}

	return template.HTML(fmt.Sprintf(`
<div class="%s" id="%s">
%s
</div>`, "binderSVG", id, code))
}

func (w *wrapper) getSVGFile(id string) string {
	//TODO
	d, _ := w.owner.GetDiagram(id)
	f := fs.SVGFile(d)
	buf := strings.Replace(f, w.owner.fileSystem.GetPublic(), "", 1)
	return fs.ConvertHTTPPath(buf)
}

func safeTemplate(src string) string {
	return src
}

func localeDateScript(src string) template.HTML {
	return template.HTML(fmt.Sprintf(`
<script>
var d = new Date("%s");
document.write(d.toLocaleString());
</script>`, src))
}

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"drawDiagram": w.drawSVG,
		"replace":     strings.ReplaceAll,
		"assets":      w.assets,
		"latestNotes": w.latestNotes,
		"safe":        safeTemplate,
		"localeDate":  localeDateScript,
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

func (b *Binder) createHTMLTemplate(w *wrapper, typ string, text string) (*template.Template, error) {

	if b == nil {
		return nil, EmptyError
	}

	var err error
	//FuncMapを準備
	tmpl := template.New(fs.TemplatePageRoot).Funcs(defineFuncMap(w))

	layId := "layout"
	conId := "content"

	if w.note != nil {
		layId = w.note.LayoutTemplate
		conId = w.note.ContentTemplate
	}

	if typ == "layout" && text != "" {

		//レイアウトをテキストで代用
		data := fs.AddTemplateFrame(db.LayoutTemplateType, []byte(text))

		_, err = tmpl.Parse(string(data))
		if err != nil {
			return nil, xerrors.Errorf("layout Parse() error: %w", err)
		}
	} else {
		layoutFile := fs.ConvertHTTPPath(fs.TemplateFile(layId))
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, layoutFile)
		if err != nil {
			return nil, xerrors.Errorf("layout ParseFS() error: %w", err)
		}
	}

	if typ == "content" && text != "" {

		data := fs.AddTemplateFrame(db.ContentTemplateType, []byte(text))
		_, err = tmpl.Parse(string(data))
		if err != nil {
			return nil, xerrors.Errorf("Parse() error: %w", err)
		}

	} else {

		tmpFile := fs.ConvertHTTPPath(fs.TemplateFile(conId))
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, tmpFile)
		if err != nil {
			return nil, xerrors.Errorf("Parse() error: %w", err)
		}
	}

	return tmpl, nil
}

// ノートの要素を一度テンプレート処理を行う
func (b *Binder) ParseElement(note *model.Note, local bool, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}

	wrap, err := newWrapper(b, local, note)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := template.New("").Funcs(defineFuncMap(wrap)).Parse(elm)
	if err != nil {
		return "", xerrors.Errorf("Element Parse() error: %w", err)
	}

	dto, err := b.createDto(wrap, elm)
	if err != nil {
		return "", xerrors.Errorf("creteDto() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, dto)
	if err != nil {
		return "", xerrors.Errorf("elm Execute() error: %w", err)
	}
	return builder.String(), nil
}

func (b *Binder) createDto(w *wrapper, elm string) (interface{}, error) {
	if b == nil {
		return nil, EmptyError
	}

	config, err := b.db.GetConfig()
	if err != nil {
		return nil, xerrors.Errorf("GetConfig() error: %w", err)
	}

	home := struct {
		Name   string
		Detail string
		Link   string
	}{config.Name, config.Detail, "./"}

	note := w.getCurrentNote()

	dto := struct {
		Home   interface{}
		Note   *tempNote
		Marked template.HTML
	}{home, note, template.HTML(elm)}

	return dto, nil
}
func (b *Binder) writeHTML(w io.Writer, tmpl *template.Template, dto interface{}) error {

	if b == nil {
		return EmptyError
	}

	//出力
	err := tmpl.Execute(w, dto)
	if err != nil {
		return xerrors.Errorf("tmpl Execute() error: %w", err)
	}
	return nil
}

// HTMLファイル出力用
func (b *Binder) generateHTML(w *wrapper) error {

	if b == nil {
		return EmptyError
	}

	//HTMLファイルの設定
	n := fs.HTMLFile(w.note)

	fp, err := b.fileSystem.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	tmpl, err := b.createHTMLTemplate(w, "", "")
	if err != nil {
		return xerrors.Errorf("createHTMLTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, "")
	if err != nil {
		return xerrors.Errorf("creteDto() error: %w", err)
	}

	err = b.writeHTML(fp, tmpl, dto)
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}
	return nil
}

// HTMLメモリ作成
func (b *Binder) CreateNoteHTML(note *model.Note, local bool, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}

	w, err := newWrapper(b, local, note)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := b.createHTMLTemplate(w, "", "")
	if err != nil {
		return "", xerrors.Errorf("createHTMLTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, elm)
	if err != nil {
		return "", xerrors.Errorf("creteDto() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, dto)
	if err != nil {
		return "", xerrors.Errorf("writeHTML() error: %w", err)
	}
	return builder.String(), nil
}

func (b *Binder) CreateTemplateHTML(temp *model.Template, note *model.Note, data string, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}
	w, err := newWrapper(b, true, note)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := b.createHTMLTemplate(w, temp.Typ, data)
	if err != nil {
		return "", xerrors.Errorf("createHTMLTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, elm)
	if err != nil {
		return "", xerrors.Errorf("creteDto() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, dto)
	if err != nil {
		return "", xerrors.Errorf("writeHTML() error: %w", err)
	}

	return builder.String(), nil
}
