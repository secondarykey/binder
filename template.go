package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"
	"log"
	"strings"
	"time"

	"html/template"
	"io"

	"golang.org/x/xerrors"
)

type tempNote struct {
	ID      string
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

type tempPage struct {
	Index int
	Link  string
}

func (w *wrapper) nowPage() tempPage {
	return w.newPage(w.now)
}

func (w *wrapper) newPage(idx int) tempPage {

	var p tempPage
	p.Index = idx
	parent := "."
	if w.isNote() {
		parent = ".."
	}

	if idx >= 1 {
		page := "list.html"
		if idx != 1 {
			page = fmt.Sprintf("list_%d.html", idx)
		}
		p.Link = parent + "/" + page
	}

	return p
}

func isNote(t TemplateType) bool {
	if t == IndexTemplateType || t == ListTemplateType || t == LayoutTemplateType {
		return false
	}
	return true
}

type TemplateType string

const (
	LayoutTemplateType TemplateType = "layout"
	IndexTemplateType  TemplateType = "index"
	ListTemplateType   TemplateType = "list"
	NoteTemplateType   TemplateType = "note"
)

type wrapper struct {
	owner *Binder
	Type  TemplateType
	ID    string

	Local bool

	now     int
	maxPage int
	listNum int
}

func newWrapper(o *Binder, local bool, t TemplateType, id string, now int) (*wrapper, error) {

	var w wrapper

	w.owner = o
	w.Local = local
	w.Type = t
	w.ID = id
	w.now = now

	if w.now == 1 {
		err := w.initPaging()
		if err != nil {
			return nil, xerrors.Errorf("initPaging() error: %w", err)
		}
	}

	return &w, nil
}

func (w *wrapper) localAddr() string {
	return fmt.Sprintf("http://%s", w.owner.ServerAddress())
}

func (w *wrapper) assetsDir() string {

	assets := "./assets"
	if w.Local {
		assets = w.localAddr() + "/assets"
	} else if w.isNote() {
		assets = "../assets"
	}
	return assets
}

func (w *wrapper) publicAssets(id string) string {
	return w.assetsDir() + "/" + id
}

func (w *wrapper) assets(id string) string {
	return w.assetsDir() + "/" + w.ID + "/" + id
}

func (w *wrapper) isNote() bool {
	return isNote(w.Type)
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

// Listを出力する前にカウントなどを初期化する
func (w *wrapper) initPaging() error {

	//TODO ページの表示数
	w.listNum = 20

	//ページ数を取得
	notes := w.latestNotes(-1)
	m := len(notes)
	if w.listNum > 0 {
		//config.ListNum
		w.maxPage = (m / w.listNum) + 1
		if m%w.listNum == 0 {
			w.maxPage--
		}
	} else {
		w.maxPage = 1
		w.listNum = m
	}

	return nil
}

func (w *wrapper) pageNotes() []*tempNote {
	offset := w.listNum * (w.now - 1)
	return w.getNotes(w.listNum, offset)
}

func (w *wrapper) prevPages(n int) []*tempPage {

	rtn := make([]*tempPage, 0, n)

	m := w.now - n
	if m < 1 {
		m = 1
	}

	for idx := w.now - 1; idx >= m; idx-- {
		p := w.newPage(idx)
		rtn = append(rtn, &p)
	}
	return rtn
}

func (w *wrapper) nextPages(n int) []*tempPage {

	rtn := make([]*tempPage, 0, n)

	m := w.now + n
	if m > w.maxPage {
		m = w.maxPage
	}

	for idx := w.now + 1; idx <= m; idx++ {
		p := w.newPage(idx)
		rtn = append(rtn, &p)
	}
	return rtn
}

func (w *wrapper) convertNote(n *model.Note) *tempNote {

	var t tempNote

	t.ID = n.Id
	t.Name = n.Name
	t.Detail = n.Detail
	t.Publish = formatTime(n.Publish)
	t.Created = formatTime(n.Created)
	t.Updated = formatTime(w.getUpdatedNoteFile(n.Id))

	parent := "./notes"
	if w.Local {
		parent = w.localAddr() + "/notes"
	} else if w.isNote() {
		parent = "."
	}
	t.Link = fmt.Sprintf("%s/%s.html", parent, n.Id)

	parent = "./assets"
	if w.Local {
		parent = w.localAddr() + "/assets"
	} else if w.isNote() {
		parent = "../assets"
	}

	t.Image = fmt.Sprintf("%s/%s/index", parent, n.Id)

	return &t
}

func (w *wrapper) getUpdatedNoteFile(id string) time.Time {
	info, err := w.owner.fileSystem.Stat(fs.NoteHTML(id))
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

func (w *wrapper) getCurrentNote() *tempNote {

	if w.ID == "" {
		return nil
	}

	note, err := w.owner.GetNote(w.ID)
	if err != nil {
		log.Println(err)
		return nil
	}

	if note == nil {
		log.Println("note is nil", w.ID)
		return nil
	}

	return w.convertNote(note)
}

func safeTemplate(src string) string {
	return src
}

func localeDateScript(src string) template.HTML {
	return template.HTML(fmt.Sprintf(`<script>var d = new Date("%s");document.write(d.toLocaleString());</script>`, src))
}

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"replace":      strings.ReplaceAll,
		"assets":       w.assets,
		"publicAssets": w.publicAssets,
		"latestNotes":  w.latestNotes,
		"isNote":       w.isNote,
		"pageNotes":    w.pageNotes,
		"prevPages":    w.prevPages,
		"nextPages":    w.nextPages,
		"safe":         safeTemplate,
		"localeDate":   localeDateScript,
		"lf2br":        convertLF2BR,
		"lf2sp":        convertLF2SP,
		"lf2comma":     convertLF2Comma,
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

func (b *Binder) createTemplate(w *wrapper, text string) (*template.Template, error) {

	var err error
	//FuncMapを準備
	tmpl := template.New(fs.TemplatePageRoot).Funcs(defineFuncMap(w))

	if w.Type == LayoutTemplateType && text != "" {
		//レイアウトをテキストで代用
		data := b.fileSystem.AddTemplateFrame(string(LayoutTemplateType), []byte(text))
		_, err = tmpl.Parse(string(data))
		if err != nil {
			return nil, xerrors.Errorf("layout Parse() error: %w", err)
		}
	} else {
		layoutFile := fs.TemplateFileName(string(LayoutTemplateType))
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, layoutFile)
		if err != nil {
			return nil, xerrors.Errorf("layout ParseFS([%s]) error: %w", layoutFile, err)
		}
	}

	if w.Type != LayoutTemplateType && text != "" {

		data := b.fileSystem.AddTemplateFrame(string(w.Type), []byte(text))
		_, err = tmpl.Parse(string(data))
		if err != nil {
			return nil, xerrors.Errorf("Parse() error: %w", err)
		}

	} else {

		t := string(w.Type)
		if w.Type == LayoutTemplateType {
			t = string(NoteTemplateType)
		}

		tmpFile := fs.TemplateFileName(t)
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, tmpFile)
		if err != nil {
			return nil, xerrors.Errorf("[%s] Parse() error: %w", w.ID, err)
		}
	}

	return tmpl, nil
}

// ノートの要素を一度テンプレート処理を行う
func (b *Binder) ParseElement(id string, local bool, elm string) (string, error) {

	wrap, err := newWrapper(b, local, NoteTemplateType, id, 0)
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

	config, err := b.db.GetConfig()
	if err != nil {
		return nil, xerrors.Errorf("GetConfig() error: %w", err)
	}

	home := struct {
		Name   string
		Detail string
		Link   string
	}{config.Name, config.Detail, "./"}

	page := struct {
		List  tempPage
		Now   tempPage
		Prev  tempPage
		First tempPage
		Next  tempPage
		Last  tempPage
	}{}

	page.List = w.newPage(1)
	page.Now = w.nowPage()
	if w.now >= 1 {
		page.First = w.newPage(1)
		page.Last = w.newPage(w.maxPage)
		if w.now > 1 {
			page.Prev = w.newPage(w.now - 1)
		}
		if w.now < w.maxPage {
			page.Next = w.newPage(w.now + 1)
		}
	}

	note := w.getCurrentNote()

	dto := struct {
		Home   interface{}
		Note   *tempNote
		Page   interface{}
		Marked template.HTML
	}{home, note, page, template.HTML(elm)}

	return dto, nil
}

func (b *Binder) writeHTML(w io.Writer, tmpl *template.Template, dto interface{}) error {
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

func (b *Binder) SaveTemplate(id string, data []byte) error {

	err := b.fileSystem.WriteTemplate(id, data)
	if err != nil {
		return xerrors.Errorf("WriteTemplate() error: %w", err)
	}

	return nil
}

// リストも一緒に出力
func (b *Binder) GenerateIndexHTML() error {

	w, err := newWrapper(b, false, IndexTemplateType, "", 0)
	if err != nil {
		return xerrors.Errorf("newWrapper(index) error: %w", err)
	}

	err = b.generateHTML(w)
	if err != nil {
		return xerrors.Errorf("generateHTML(index) error: %w", err)
	}

	//list*.htmlをすべて削除する
	err = b.fileSystem.DeleteListHTMLs()
	if err != nil {
		return xerrors.Errorf("DeleteListHTMLs() error: %w", err)
	}

	//ページ数を換算する
	w, err = newWrapper(b, false, ListTemplateType, "", 1)
	if err != nil {
		return xerrors.Errorf("newWrapper(list) error: %w", err)
	}

	for i := 1; i <= w.maxPage; i++ {
		w.now = i
		err = b.generateHTML(w)
		if err != nil {
			return xerrors.Errorf("generateHTML(list) error: %w", err)
		}
	}

	return nil
}

// HTMLファイル出力用
func (b *Binder) generateHTML(w *wrapper) error {

	n := ""
	if w.Type == IndexTemplateType {
		n = fs.IndexHTML()
	} else {
		n = fs.ListHTML(w.now)
	}

	fp, err := b.fileSystem.Create(n)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	tmpl, err := b.createTemplate(w, "")
	if err != nil {
		return xerrors.Errorf("createTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, "")
	if err != nil {
		return xerrors.Errorf("creteDto() error: %w", err)
	}

	err = b.writeHTML(fp.(io.Writer), tmpl, dto)
	if err != nil {
		return xerrors.Errorf("writeHTML() error: %w", err)
	}
	return nil
}

// HTMLメモリ作成
func (b *Binder) CreateNoteHTML(id string, local bool, elm string) (string, error) {

	w, err := newWrapper(b, local, NoteTemplateType, id, 0)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := b.createTemplate(w, "")
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, elm)
	if err != nil {
		return "", xerrors.Errorf("creteDto() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, dto)
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}
	return builder.String(), nil
}

func (b *Binder) CreateTemplateHTML(t TemplateType, id string, temp string, elm string) (string, error) {

	now := 0
	if t == ListTemplateType {
		now = 1
	}

	w, err := newWrapper(b, true, t, id, now)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := b.createTemplate(w, temp)
	if err != nil {
		return "", xerrors.Errorf("createTemplate() error: %w", err)
	}

	dto, err := b.createDto(w, elm)
	if err != nil {
		return "", xerrors.Errorf("creteDto() error: %w", err)
	}

	var builder strings.Builder
	err = b.writeHTML(&builder, tmpl, dto)
	if err != nil {
		return "", xerrors.Errorf("generateHTML() error: %w", err)
	}

	return builder.String(), nil
}
