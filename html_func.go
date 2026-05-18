package binder

import (
	"fmt"
	"html/template"
	"strings"
	"time"
	texttemplate "text/template"

	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"binder/log"

	"golang.org/x/xerrors"
)

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"embed":         w.embed,
		"drawDiagram":   w.drawSVG,
		"drawLayer":     w.drawLayer,
		"assets":        w.assets,
		"assetsImage":   w.assetsImage,
		"childrenNotes": w.childrenNotes,
		"latestNotes":   w.latestNotes,
		"breadcrumb":    w.breadcrumb,
		"safe":          safeTemplate,
		"lit":           litTemplate,
		"litURL":        litURLTemplate,
		"replace":       strings.ReplaceAll,
		"localeDate":    localeDateScript,
		"formatDate":    formatDate,
		"lf2br":         convertLF2BR,
		"lf2sp":         convertLF2SP,
		"lf2comma":      convertLF2Comma,
	}
	return funcMap
}

// 可変引数ヘルパー
type ArgHelper[T any] struct {
	args  []any
	index int
}

// ヘルパー生成
func Arg[T any](args []any, index int) ArgHelper[T] {
	return ArgHelper[T]{args: args, index: index}
}

// 指定の値を取得
func (h ArgHelper[T]) get() (T, bool) {
	var zero T
	if h.index < 0 || h.index >= len(h.args) {
		return zero, false
	}
	val, ok := h.args[h.index].(T)
	if !ok {
		log.Warn(fmt.Sprintf("[%d] expected %T got %T", h.index, *new(T), h.args[h.index]))
	}
	return val, ok
}

// 必須
func (h ArgHelper[T]) Required() (T, bool) {
	return h.get()
}

// デフォルト値
func (h ArgHelper[T]) Default(def T) T {
	v, ok := h.get()
	if !ok {
		return def
	}
	return v
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

	if w.deps != nil {
		w.deps.assets[id] = a
	}

	p := fs.PublicAssetFile(a)
	return w.convertURL(p)
}

// assetsImage はアセットIDから <img> タグを生成するテンプレート関数
// 生成される <img> タグには常に "binderAssets" クラスが付与される。
// 第2引数でクラス名を指定した場合は "binderAssets" に追加する形で連結される。
func (w *wrapper) assetsImage(v ...any) template.HTML {

	//アセットId
	id, ok := Arg[string](v, 0).Required()
	if !ok {
		return template.HTML(fmt.Sprintf(`assets id error`))
	}
	//クラス名指定（空可）。常に "binderAssets" を先頭に付与する。
	clazz := Arg[string](v, 1).Default("")
	classAttr := "binderAssets"
	if strings.TrimSpace(clazz) != "" {
		classAttr = classAttr + " " + clazz
	}

	src := w.assets(id)

	return template.HTML(fmt.Sprintf(`<img src="%s" class="%s">`, src, classAttr))
}

func (w *wrapper) childrenNotes(v ...any) []*tempNote {
	//件数
	n := Arg[int](v, 0).Default(-1)
	//指定ノートId（ダイアグラムコンテキストでは w.note が nil のため空文字をデフォルトとする）
	defaultId := ""
	if w.note != nil {
		defaultId = w.note.Id
	}
	id := Arg[string](v, 1).Default(defaultId)
	if id == "" {
		return nil
	}
	// 順序指定: "seq" でツリー順、省略時は従来動作（publish_date/updated_date）
	order := Arg[string](v, 2).Default("")
	if order == "seq" {
		return w.getSeqNotes(id, n)
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

func (w *wrapper) getSeqNotes(id string, limit int) []*tempNote {
	notes, err := w.owner.db.FindSeqNotes(id, limit, -1)
	if err != nil {
		log.ErrorE("FindSeqNotes()", err)
		return nil
	}

	ids := make([]interface{}, len(notes))
	for i, n := range notes {
		ids[i] = n.Id
	}
	structMap, _ := w.owner.getStructureMap(ids...)

	rtn := make([]*tempNote, len(notes))
	for idx, n := range notes {
		jn := n.To()
		if s, ok := structMap[n.Id]; ok {
			jn.ApplyStructure(s.To())
		}
		rtn[idx] = w.convertNote(jn)
	}
	return rtn
}

// breadcrumb は現在ノートの祖先チェーンを root→current の順で返す。
func (w *wrapper) breadcrumb() []*tempNote {
	if w.note == nil {
		return nil
	}
	var chain []*tempNote
	id := w.note.Id
	for id != "" && id != "index" {
		s, err := w.owner.db.GetStructure(id)
		if err != nil {
			break
		}
		jn := &json.Note{Id: s.Id, Name: s.Name, Detail: s.Detail, Alias: s.Alias}
		chain = append(chain, w.convertNote(jn))
		id = s.ParentId
	}
	// index を先頭に追加
	indexS, err := w.owner.db.GetStructure("index")
	if err == nil {
		jn := &json.Note{Id: indexS.Id, Name: indexS.Name, Detail: indexS.Detail, Alias: indexS.Alias}
		chain = append(chain, w.convertNote(jn))
	}
	// reverse: root→current
	for i, j := 0, len(chain)-1; i < j; i, j = i+1, j-1 {
		chain[i], chain[j] = chain[j], chain[i]
	}
	return chain
}

func (w *wrapper) drawSVG(id string) template.HTML {

	code := ""
	if w.Local {
		var d strings.Builder
		if err := w.owner.ReadDiagram(&d, id); err != nil {
			return template.HTML(err.Error())
		}
		code = d.String()

		diag, err := w.owner.GetDiagram(id)
		if err != nil {
			return template.HTML(err.Error())
		}

		// ダイアグラム内容のテンプレート関数を処理する
		if parsed, err := w.owner.ParseDiagram(diag, w.Local, code); err == nil {
			code = parsed
		}

		// スタイルテンプレートのディレクティブを付与
		if diag.StyleTemplate != "" {
			var sb strings.Builder
			if err := w.owner.ReadTemplate(&sb, diag.StyleTemplate); err == nil {
				code = fmt.Sprintf("%%%%{init:%s}%%%%\n%s", sb.String(), code)
			}
		}
	} else {

		if w.deps != nil {
			diag, err := w.owner.GetDiagram(id)
			if err == nil {
				w.deps.diagrams[id] = diag
			}
		}

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

// drawLayer はレイヤーIDから画像 + SVG オーバーレイの合成HTMLを返す。
// 親 Asset の画像を下敷きにし、その上に Layer のシェイプを重ねる。
// エディタプレビュー（local=true）ではインラインSVGとプライベートアセットURLを使い、
// 公開時は公開済みSVGをimgで重ねる。
// 第1引数: レイヤーID（必須）。第2引数: 追加の class 名（省略可）。
func (w *wrapper) drawLayer(v ...any) template.HTML {

	// レイヤーID
	id, ok := Arg[string](v, 0).Required()
	if !ok {
		return template.HTML(`drawLayer id error`)
	}
	// クラス名指定（省略可）
	clazz := Arg[string](v, 1).Default("")

	imageSrc := ""
	svgSrc := ""
	if w.Local {
		// 親Assetのプライベートアセット配信URL
		m, err := w.owner.GetLayerWithParent(id)
		if err != nil {
			return template.HTML(fmt.Sprintf("drawLayer error: %v", err))
		}
		addr := w.owner.ServerAddress()
		if addr == "" {
			return template.HTML("drawLayer: server not available")
		}
		if m.Parent != nil {
			imageSrc = fmt.Sprintf("http://%s/binder-assets/%s", addr, m.Parent.Id)
		}
	} else {
		// 公開時は親 Asset の公開パスを参照
		m, err := w.owner.GetLayerWithParent(id)
		if err != nil {
			return template.HTML(fmt.Sprintf("drawLayer error: %v", err))
		}
		if w.deps != nil {
			w.deps.layers[id] = m
			if m.Parent != nil {
				w.deps.assets[m.ParentId] = m.Parent
			}
		}
		if m.Parent != nil {
			imageSrc = w.convertURL(fs.PublicAssetFile(m.Parent))
		}
		svgSrc = w.convertURL(fs.PublicLayerFile(m))
	}

	html, err := w.owner.BuildLayerHTML(id, w.Local, imageSrc, svgSrc, clazz)
	if err != nil {
		return template.HTML(fmt.Sprintf("drawLayer error: %v", err))
	}
	return html
}

func (w *wrapper) getSVGFile(id string) (string, error) {
	d, err := w.owner.GetDiagram(id)
	if err != nil {
		return "", xerrors.Errorf("GetDiagram() error: %w", err)
	}

	f := fs.SVGFile(d)
	return w.convertURL(f), nil
}

// embed は指定 ID のノートまたはテキストアセットの内容をインライン展開する。
// 返値は (template.HTML, error) であり、エラー時は Execute() が停止してフロントエンドに伝播する。
// 呼び出しパス上に同じ ID が既に存在する場合は循環参照エラーを返す。
// structure で type を確認し、note と（テキスト）asset のみをサポートする。
func (w *wrapper) embed(id string) (template.HTML, error) {
	if w.visited[id] {
		return "", xerrors.Errorf("embed: cycle detected for id=%s", id)
	}

	s, err := w.owner.db.GetStructure(id)
	if err != nil {
		return "", xerrors.Errorf("embed GetStructure() id=%s: %w", id, err)
	}

	switch s.Typ {
	case "note":
		return w.embedNote(id)
	case "asset":
		return w.embedTextAsset(id)
	default:
		return "", xerrors.Errorf("embed: unsupported type=%s id=%s", s.Typ, id)
	}
}

// embedNote はノートの Markdown 本文をテンプレート処理してインライン展開する。
func (w *wrapper) embedNote(id string) (template.HTML, error) {
	note, err := w.owner.GetNote(id)
	if err != nil {
		return "", xerrors.Errorf("embed GetNote() id=%s: %w", id, err)
	}

	var buf strings.Builder
	if err := w.owner.ReadNote(&buf, id); err != nil {
		return "", xerrors.Errorf("embed ReadNote() id=%s: %w", id, err)
	}

	childWrap := &wrapper{
		owner:         w.owner,
		note:          note,
		Local:         w.Local,
		visited:       w.visitedWith(id),
		deps:          w.deps,
		exportAsIndex: w.exportAsIndex,
	}

	content := buf.String()
	tmpl, err := texttemplate.New("").Funcs(texttemplate.FuncMap(defineFuncMap(childWrap))).Parse(content)
	if err != nil {
		return "", xerrors.Errorf("embed Parse() id=%s: %w", id, err)
	}

	dto, err := w.owner.createDto(childWrap, content)
	if err != nil {
		return "", xerrors.Errorf("embed createDto() id=%s: %w", id, err)
	}

	var out strings.Builder
	if err := tmpl.Execute(&out, dto); err != nil {
		return "", xerrors.Errorf("embed Execute() id=%s: %w", id, err)
	}

	return template.HTML(out.String()), nil
}

// embedTextAsset はテキストアセットの内容をテンプレート処理してインライン展開する。
// バイナリアセットは対象外。親ノートのコンテキストを継承してテンプレート関数を使用できる。
func (w *wrapper) embedTextAsset(id string) (template.HTML, error) {
	a, err := w.owner.db.GetAsset(id)
	if err != nil {
		return "", xerrors.Errorf("embed GetAsset() id=%s: %w", id, err)
	}
	if a.Binary {
		return "", xerrors.Errorf("embed: asset is binary id=%s", id)
	}

	data, _, err := w.owner.ReadAssetBytes(id)
	if err != nil {
		return "", xerrors.Errorf("embed ReadAssetBytes() id=%s: %w", id, err)
	}

	childWrap := &wrapper{
		owner:         w.owner,
		note:          w.note,
		Local:         w.Local,
		visited:       w.visitedWith(id),
		deps:          w.deps,
		exportAsIndex: w.exportAsIndex,
	}

	content := string(data)
	tmpl, err := texttemplate.New("").Funcs(texttemplate.FuncMap(defineFuncMap(childWrap))).Parse(content)
	if err != nil {
		return "", xerrors.Errorf("embed asset Parse() id=%s: %w", id, err)
	}

	dto, err := w.owner.createDto(childWrap, content)
	if err != nil {
		return "", xerrors.Errorf("embed asset createDto() id=%s: %w", id, err)
	}

	var out strings.Builder
	if err := tmpl.Execute(&out, dto); err != nil {
		return "", xerrors.Errorf("embed asset Execute() id=%s: %w", id, err)
	}

	return template.HTML(out.String()), nil
}

func safeTemplate(src string) string {
	return src
}

// litTemplate はテキスト・HTML属性コンテキストでテンプレート構文をそのまま出力する。
// URL属性（href等）では litURLTemplate を使うこと。
func litTemplate(src string) template.HTML {
	return template.HTML(src)
}

// litURLTemplate はURLコンテキスト（href等）でテンプレート構文をそのまま出力する。
// html/template のURL正規化（{ → %7B）をバイパスする。
func litURLTemplate(src string) template.URL {
	return template.URL(src)
}

func formatDate(d string, f string) string {

	t, e := time.Parse(time.RFC3339, d)
	if e != nil {
		log.WarnE("format error:"+d, e)
		return d
	}
	return t.Format(f)
}

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

func localeDateScript(src string) template.HTML {
	return template.HTML(fmt.Sprintf(`
<script>
var d = new Date("%s");
document.write(d.toLocaleString());
</script>`, src))
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
