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
	Publish time.Time
	Created time.Time
	Updated time.Time

	Link  string
	Image string
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

func isNote(id string) bool {
	if id == "index" || id == "list" || id == "layout" {
		return false
	}
	return true
}

type wrapper struct {
	owner *Binder
	Local bool
	ID    string
	now   int

	maxPage int
	listNum int
}

func newWrapper(o *Binder, local bool, id string, now int) *wrapper {
	var w wrapper

	w.owner = o
	w.Local = local
	w.ID = id
	w.now = now

	return &w
}

func (w *wrapper) assetsDir() string {

	assets := "./assets"
	if w.Local {
		assets = fmt.Sprintf("http://%s/%s", w.owner.ServerAddress(), "assets")
	} else if isNote(w.ID) {
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
	return isNote(w.ID)
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

	if err != nil {
		log.Println(err)
		return nil
	}

	rtn := make([]*tempNote, len(notes))
	for idx, n := range notes {
		rtn[idx] = w.convertNote(n)
	}
	return rtn
}

// Listを出力する前にカウントなどを初期化する
func (w *wrapper) initPaging() error {

	config, err := w.owner.db.GetConfig()
	if err != nil {
		return xerrors.Errorf("GetConfig() error: %w", err)
	}

	w.now = 1
	w.listNum = config.ListNum

	//ページ数を取得
	//TODO 実際にはカウントで取得したい
	notes := w.latestNotes(-1)
	m := len(notes)

	if config.ListNum != 0 {
		//config.ListNum
		w.maxPage = (m / config.ListNum) + 1
		if m%config.ListNum == 0 {
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
	t.ID = n.ID
	t.Name = n.Name
	t.Detail = n.Detail
	t.Publish = n.Publish
	t.Created = n.Created
	t.Updated = n.Updated

	parent := "./notes"
	if w.Local {
		parent = fmt.Sprintf("http://%s/%s", w.owner.ServerAddress(), "notes")
	} else if w.isNote() {
		parent = "."
	}
	t.Link = fmt.Sprintf("%s/%s.html", parent, n.ID)

	parent = "./assets"
	if w.Local {
		parent = fmt.Sprintf("http://%s/%s", w.owner.ServerAddress(), "assets")
	} else if w.isNote() {
		parent = "../assets"
	}

	t.Image = fmt.Sprintf("%s/%s/index", parent, n.ID)

	return &t
}

func safeTemplate(src string) string {
	return src
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

	if w.ID == "layout" && text != "" {
		//レイアウトをテキストで代用
		data := b.fileSystem.AddTemplateFrame(w.ID, []byte(text))
		_, err = tmpl.Parse(string(data))
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

	if w.ID != "layout" && text != "" {
		data := b.fileSystem.AddTemplateFrame(w.ID, []byte(text))
		_, err = tmpl.Parse(string(data))
		if err != nil {
			return nil, xerrors.Errorf("Parse() error: %w", err)
		}
	} else {
		tId := w.ID
		if w.ID != "index" && w.ID != "list" {
			tId = "note"
		}
		tmpFile := fs.TemplateFileName(tId)
		//layout と typeでパース
		_, err = tmpl.ParseFS(b.fileSystem, tmpFile)
		if err != nil {
			return nil, xerrors.Errorf("[%s] Parse() error: %w", w.ID, err)
		}
	}

	return tmpl, nil
}

func (b *Binder) ParseElement(id string, local bool, elm string) (string, error) {
	wrap := newWrapper(b, local, id, 0)

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
		if w.now == 1 {
			err := w.initPaging()
			if err != nil {
				return nil, xerrors.Errorf("initPaging() error: %w", err)
			}
		}

		page.First = w.newPage(1)
		page.Last = w.newPage(w.maxPage)
		if w.now > 1 {
			page.Prev = w.newPage(w.now - 1)
		}
		if w.now < w.maxPage {
			page.Next = w.newPage(w.now + 1)
		}
	}

	dto := struct {
		Home   interface{}
		Page   interface{}
		Marked template.HTML
	}{home, page, template.HTML(elm)}

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

	err := b.generateHTML("index", 0)
	if err != nil {
		return xerrors.Errorf("generateHTML(index) error: %w", err)
	}

	//list_n.htmlをすべて削除する
	//ページ数を換算する

	/*
		idx := 0
		err = b.generateHTML("list", idx+1)
		if err != nil {
			return xerrors.Errorf("generateHTML(list) error: %w", err)
		}
	*/

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
	defer fp.Close()

	w := newWrapper(b, false, id, idx)
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
	/*
		err = b.fileSystem.Commit("generate:" + id)
		if err != nil {
			return xerrors.Errorf("Commit() error: %w", err)
		}
	*/
	return nil
}

// HTMLメモリ作成
func (b *Binder) CreateNoteHTML(id string, local bool, elm string) (string, error) {

	w := newWrapper(b, local, id, 0)

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

func (b *Binder) CreateTemplateHTML(id string, temp string, elm string) (string, error) {

	now := 0
	if id == "list" {
		now = 1
	}

	w := newWrapper(b, true, id, now)
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
