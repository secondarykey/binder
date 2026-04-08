package binder

import (
	"fmt"
	"html/template"
	"io"
	"strings"
	"time"

	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"binder/log"

	"golang.org/x/xerrors"
)

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

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

type wrapper struct {
	owner *Binder
	note  *json.Note
	Local bool
	depth int // embed の再帰深度（循環参照防止）
}

func newWrapper(o *Binder, local bool, note *json.Note) (*wrapper, error) {
	var w wrapper
	w.owner = o
	w.Local = local
	w.note = note
	return &w, nil
}

func (w *wrapper) localAddr() string {
	return fmt.Sprintf("http://%s", w.owner.ServerAddress())
}

// relativePrefix は公開HTMLでのリソース参照用の相対パスプレフィックスを返す。
// index.html は docs/ 直下にあるため "./"、サブページは docs/pages/ 配下にあるため "../"。
func (w *wrapper) relativePrefix() string {
	if w.note != nil && w.note.Id != "index" {
		return "../"
	}
	return "./"
}

func (w *wrapper) assets(id string) string {
	if w.Local {
		// エディタプレビュー用: HTTPサーバーのプライベートアセットエンドポイントを使用
		addr := w.owner.ServerAddress()
		if addr == "" {
			return "assets/error"
		}
		return fmt.Sprintf("http://%s/binder-assets/%s", addr, id)
	}

	// パブリッシュ用: 従来の相対URL（公開済みアセット）
	a, err := w.owner.GetAssetWithParent(id)
	if err != nil {
		return "assets/error"
	}

	p := fs.PublicAssetFile(a)
	return w.convertURL(p)
}

// assetsImage はアセットIDから <img> タグを生成するテンプレート関数
func (w *wrapper) assetsImage(id string) template.HTML {
	src := w.assets(id)
	return template.HTML(fmt.Sprintf(`<img src="%s">`, src))
}

func (w *wrapper) childrenNotes(v ...any) []*tempNote {

	lg := len(v)

	//第一引数は件数
	n := -1
	if lg >= 1 {
		wk, ok := v[0].(int)
		if ok {
			n = wk
		} else {
			log.Warn("Tepmpalte children() validation error: number")
		}
	}

	//第二引数はノートId
	id := w.note.Id
	if lg >= 2 {
		wk, ok := v[1].(string)
		if ok {
			id = wk
		} else {
			log.Warn("Tepmpalte children() validation error: note id")
		}
	}

	return w.children(id, n, -1)
}

func (w *wrapper) children(id string, n int, offset int) []*tempNote {
	return w.getNotes(id, n, -1)
}

func (w *wrapper) latestNotes(n int) []*tempNote {
	return w.getNotes("", n, -1)
}

func (w *wrapper) getNotes(id string, limit int, offset int) []*tempNote {

	var err error
	var notes []*model.Note
	if w.Local {
		//TODO いるか？
		notes, err = w.owner.db.FindUpdatedNotes(id, limit, offset)
	} else {
		notes, err = w.owner.db.FindPublishNotes(id, limit, offset)
	}

	if err != nil {
		log.ErrorE("FindNote()", err)
		return nil
	}

	rtn := make([]*tempNote, len(notes))

	// Structure情報を取得
	ids := make([]interface{}, len(notes))
	for i, n := range notes {
		ids[i] = n.Id
	}
	structMap, _ := w.owner.getStructureMap(ids...)

	for idx, n := range notes {
		jn := n.To()
		if s, ok := structMap[n.Id]; ok {
			jn.ApplyStructure(s.To())
		}
		rtn[idx] = w.convertNote(jn)
	}
	return rtn
}

// 出力形式に変更
func (w *wrapper) convertNote(n *json.Note) *tempNote {

	var t tempNote

	t.Id = n.Id
	t.Name = n.Name
	t.Detail = n.Detail
	t.Publish = formatTime(n.Publish)
	t.Created = formatTime(n.Created)
	t.Updated = formatTime(w.getUpdatedNoteFile(n))

	p := fs.HTMLFile(n)
	t.Link = w.convertURL(p)

	// メタ画像URL: ローカルプレビュー時は絶対URLでファイルサーバー経由でアクセス
	m := fs.PublicMetaFile(n)
	if w.Local {
		addr := w.owner.ServerAddress()
		if addr != "" {
			t.Image = fmt.Sprintf("http://%s/%s", addr, w.publishRelPath(m))
		}
	} else {
		t.Image = w.convertURL(m)
	}

	//TODO PREV NEXTは？

	return &t
}

func (w *wrapper) getUpdatedNoteFile(n *json.Note) time.Time {

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

// publishRelPath は公開ディレクトリ(docs/)を除去した相対パスを返す。
func (w *wrapper) publishRelPath(p string) string {
	np := strings.ReplaceAll(p, "\\", "/")
	cp := w.owner.fileSystem.GetPublic() + "/"
	return strings.Replace(np, cp, "", 1)
}

// 取得してきたパスからURL変換
// 公開ディレクトリ(docs/)を除去し、ノートの階層に応じた相対プレフィックスを付与する。
func (w *wrapper) convertURL(p string) string {
	return w.relativePrefix() + w.publishRelPath(p)
}

func (w *wrapper) drawSVG(id string) template.HTML {

	code := ""
	if w.Local {
		var d strings.Builder
		err := w.owner.ReadDiagram(&d, id)
		if err != nil {
			return template.HTML(err.Error())
		}
		code = d.String()

		// スタイルテンプレートのディレクティブを付与
		diag, err := w.owner.GetDiagram(id)
		if err == nil && diag.StyleTemplate != "" {
			var sb strings.Builder
			if err := w.owner.ReadTemplate(&sb, diag.StyleTemplate); err == nil {
				code = fmt.Sprintf("%%%%{init:%s}%%%%\n%s", sb.String(), code)
			}
		}
	} else {

		f, err := w.getSVGFile(id)
		if err != nil {
			code = fmt.Sprintf("SVG File error: %v", err)
		} else {
			code = fmt.Sprintf(`<img src="%s">`, f)
		}

		//TODO 公開しているかを確認するのOKかも
	}

	return template.HTML(fmt.Sprintf(`
<div class="%s" id="%s">
%s
</div>`, "binderSVG", id, code))
}

func (w *wrapper) getSVGFile(id string) (string, error) {
	d, err := w.owner.GetDiagram(id)
	if err != nil {
		return "", xerrors.Errorf("GetDiagram() error: %w", err)
	}

	f := fs.SVGFile(d)
	return w.convertURL(f), nil
}

func safeTemplate(src string) string {
	return src
}

func formatDate(d string, f string) string {

	t, e := time.Parse(time.RFC3339, d)
	if e != nil {
		log.WarnE("format error:"+d, e)
		return d
	}
	return t.Format(f)
}

func localeDateScript(src string) template.HTML {
	return template.HTML(fmt.Sprintf(`
<script>
var d = new Date("%s");
document.write(d.toLocaleString());
</script>`, src))
}

// embed は指定 ID のノートの Markdown 本文をインライン展開する。
// 返値は template.HTML（エスケープなし）のため、marked.js にそのまま渡される。
// 循環参照を防ぐため depth >= 1 の場合は空文字を返す。
func (w *wrapper) embed(id string) template.HTML {
	if w.depth >= 1 {
		return ""
	}

	note, err := w.owner.GetNote(id)
	if err != nil {
		log.ErrorE("embed GetNote()", xerrors.Errorf("id=%s: %w", id, err))
		return ""
	}

	var buf strings.Builder
	if err := w.owner.ReadNote(&buf, id); err != nil {
		log.ErrorE("embed ReadNote()", xerrors.Errorf("id=%s: %w", id, err))
		return ""
	}

	childWrap := &wrapper{
		owner: w.owner,
		note:  note,
		Local: w.Local,
		depth: w.depth + 1,
	}

	content := buf.String()
	tmpl, err := template.New("").Funcs(defineFuncMap(childWrap)).Parse(content)
	if err != nil {
		log.ErrorE("embed Parse()", xerrors.Errorf("id=%s: %w", id, err))
		return ""
	}

	dto, err := w.owner.createDto(childWrap, content)
	if err != nil {
		log.ErrorE("embed createDto()", xerrors.Errorf("id=%s: %w", id, err))
		return ""
	}

	var out strings.Builder
	if err := w.owner.writeHTML(&out, tmpl, dto); err != nil {
		log.ErrorE("embed writeHTML()", xerrors.Errorf("id=%s: %w", id, err))
		return ""
	}

	return template.HTML(out.String())
}

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"drawDiagram":   w.drawSVG,
		"replace":       strings.ReplaceAll,
		"embed":         w.embed,
		"assets":        w.assets,
		"assetsImage":   w.assetsImage,
		"childrenNotes": w.childrenNotes,
		"latestNotes":   w.latestNotes,
		"safe":          safeTemplate,
		"localeDate":    localeDateScript,
		"formatDate":    formatDate,
		"lf2br":         convertLF2BR,
		"lf2sp":         convertLF2SP,
		"lf2comma":      convertLF2Comma,
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
// TODO 現在テンプレート編集時の描画を止めている為、再度実装する際に考慮する
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
func (b *Binder) ParseElement(note *json.Note, local bool, elm string) (string, error) {

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

// HTMLファイル出力用
func (b *Binder) testgenerateHTML(w *wrapper) error {

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

	tmpl, err := b.createHTMLTemplate(w)
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
