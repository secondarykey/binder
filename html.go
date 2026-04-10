package binder

import (
	"html/template"
	"io"
	"strings"
	texttemplate "text/template"

	"binder/api/json"
	"binder/fs"

	"golang.org/x/xerrors"
)

// テンプレートのダイアグラムデータ
type tempDiagram struct {
	Id      string
	Name    string
	Detail  string
	Alias   string
	Publish string
	Created string
	Updated string
}

// テンプレートのノートデータ
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

// parseTemplateFile はファイルシステムからテンプレートを読み込み、
// {{ define "..." }}...{{ end }} フレームを自動付与してパースする。
// 既存ファイルに手動でフレームが書かれていた場合は一度除去してから付与するため後方互換が保たれる。
func (b *Binder) parseTemplateFile(tmpl *template.Template, path string, typ json.TemplateType) (*template.Template, error) {

	f, err := b.fileSystem.Open(path)
	if err != nil {
		return nil, xerrors.Errorf("Open(%s) error: %w", path, err)
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		return nil, xerrors.Errorf("ReadAll(%s) error: %w", path, err)
	}

	// 既存フレームを除去（後方互換）
	raw = fs.StripTemplateFrame(typ, raw)

	// Layoutテンプレートは template.New("Pages") で生成したルートテンプレートの本体として
	// 直接パースする。{{ define "Pages" }} で包むと「関連テンプレート」になり
	// ルートが空のまま Execute() が失敗するため、フレームを付与しない。
	//
	// Contentテンプレートは layout 内の {{ template "Content" . }} から呼ばれるため
	// {{ define "Content" }}...{{ end }} で包む必要がある。
	if typ.IsContent() {
		raw = fs.AddTemplateFrame(typ, raw)
	}

	t, err := tmpl.Parse(string(raw))
	if err != nil {
		return nil, xerrors.Errorf("Parse(%s) error: %w", path, err)
	}
	return t, nil
}

// テンプレートを作成
// text が指定してある場合、テンプレート編集時になる為、
// 指定してあるテンプレートではなく、文字列を使用して描画を行う
func (b *Binder) createHTMLTemplate(w *wrapper) (*template.Template, error) {

	if b == nil {
		return nil, EmptyError
	}

	var err error
	//FuncMapを準備
	tmpl := template.New(fs.TemplatePageRoot).Funcs(defineFuncMap(w))

	layId := w.note.LayoutTemplate
	conId := w.note.ContentTemplate

	layoutFile := fs.ConvertHTTPPath(fs.TemplateFile(layId))
	tmpl, err = b.parseTemplateFile(tmpl, layoutFile, json.LayoutTemplateType)
	if err != nil {
		return nil, xerrors.Errorf("layout parseTemplateFile() error: %w", err)
	}

	tmpFile := fs.ConvertHTTPPath(fs.TemplateFile(conId))
	tmpl, err = b.parseTemplateFile(tmpl, tmpFile, json.ContentTemplateType)
	if err != nil {
		return nil, xerrors.Errorf("content parseTemplateFile() error: %w", err)
	}

	return tmpl, nil
}

// ノートの要素を一度テンプレート処理を行う
func (b *Binder) ParseNote(note *json.Note, local bool, elm string) (string, error) {

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

	config, err := b.GetConfig()
	if err != nil {
		return nil, xerrors.Errorf("GetConfig() error: %w", err)
	}

	home := struct {
		Name   string
		Detail string
		Link   string
	}{config.Name, config.Detail, w.relativePrefix()}

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

// HTMLメモリ作成
func (b *Binder) CreateNoteHTML(note *json.Note, local bool, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}

	w, err := newWrapper(b, local, note)
	if err != nil {
		return "", xerrors.Errorf("newWrapper() error: %w", err)
	}

	tmpl, err := b.createHTMLTemplate(w)
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

// ダイアグラムの要素を一度テンプレート処理を行う。
// Mermaid 記法には `-->` や `&` が含まれるため、HTML エスケープを避けるため text/template を使用する。
func (b *Binder) ParseDiagram(diag *json.Diagram, local bool, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}

	wrap := &wrapper{owner: b, Local: local}

	tmpl, err := texttemplate.New("").Funcs(texttemplate.FuncMap(defineFuncMap(wrap))).Parse(elm)
	if err != nil {
		return "", xerrors.Errorf("Diagram Parse() error: %w", err)
	}

	config, err := b.GetConfig()
	if err != nil {
		return "", xerrors.Errorf("GetConfig() error: %w", err)
	}

	home := struct {
		Name   string
		Detail string
	}{config.Name, config.Detail}

	td := &tempDiagram{
		Id:      diag.Id,
		Name:    diag.Name,
		Detail:  diag.Detail,
		Alias:   diag.Alias,
		Publish: formatTime(diag.Publish),
		Created: formatTime(diag.Created),
		Updated: formatTime(diag.Updated),
	}

	dto := struct {
		Home    interface{}
		Diagram *tempDiagram
	}{home, td}

	var builder strings.Builder
	if err := tmpl.Execute(&builder, dto); err != nil {
		return "", xerrors.Errorf("Diagram Execute() error: %w", err)
	}
	return builder.String(), nil
}

func (b *Binder) CreateTemplateHTML(id string, typ json.TemplateType, oId string, note *json.Note, elm string) (string, error) {

	if b == nil {
		return "", EmptyError
	}

	//ノートのテンプレートを書き換える
	if typ == json.LayoutTemplateType {
		note.LayoutTemplate = id
		note.ContentTemplate = oId
	} else {
		note.LayoutTemplate = oId
		note.ContentTemplate = id
	}

	return b.CreateNoteHTML(note, true, elm)
}
