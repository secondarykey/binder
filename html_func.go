package binder

import (
	"encoding/base64"
	"fmt"
	"html/template"
	"sort"
	"strings"
	texttemplate "text/template"
	"time"

	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"binder/log"

	"golang.org/x/xerrors"
)

func templateError(msg string) template.HTML {
	return template.HTML(fmt.Sprintf(`<div class="binderError" style="color:red;">%s</div>`, template.HTMLEscapeString(msg)))
}

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"embed":         w.embed,
		"link":          w.link,
		"url":           w.url,
		"drawDiagram":   w.drawSVG,
		"drawLayer":     w.drawLayer,
		"assets":        w.assets,
		"assetsImage":   w.assetsImage,
		"childrenNotes": w.childNotes,
		"childNotes":    w.childNotes,
		"latestNotes":   w.latestNotes,
		"breadcrumb":    w.breadcrumb,
		"prevNote":      w.prevNote,
		"nextNote":      w.nextNote,
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
		log.Warnf("[%d] expected %T got %T", h.index, *new(T), h.args[h.index])
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

// assets はアセットの参照URLを template.URL で返す。
// 戻り値を string にすると、ローカルプレビューの data URI が
// html/template の URL サニタイザで href="#ZgotmplZ" に置換され、
// <link rel="stylesheet" href="{{assets ...}}"> 等でCSSが適用されなくなる。
// assetURL はアセットの URL を返す共通コア。
// Local は data URI で埋め込み（HTTPサーバ非依存）、それ以外は公開パス。
func (w *wrapper) assetURL(fn string, id string) (template.URL, error) {
	if w.Local {
		uri, err := w.owner.AssetDataURI(id)
		if err != nil {
			return "", err
		}
		return template.URL(uri), nil
	}

	a, err := w.owner.GetAssetWithParent(id)
	if err != nil {
		return "", err
	}

	// プレビューでは data URI で問題なく表示されるため、未公開のまま公開すると
	// 画像だけが 404 になる。公開時に気付けるようにする
	w.warnUnreachable(fn, id, a.Private, a.Republish)

	if w.deps != nil {
		w.deps.assets[id] = a
	}

	p := fs.PublicAssetFile(a)
	return template.URL(w.convertURL(p)), nil
}

// assets はテンプレート関数。エラー時はプレビューに表示する ERROR 文字列を返す。
func (w *wrapper) assets(id string) template.URL {
	src, err := w.assetURL("assets", id)
	if err != nil {
		w.addWarning(fmt.Sprintf("assets(%s): %v", id, err))
		return template.URL(fmt.Sprintf("ERROR: assets(%s): %v", id, err))
	}
	return src
}

// assetsImage はアセットIDから <img> タグを生成するテンプレート関数
// 生成される <img> タグには常に "binderAssets" クラスが付与される。
// 第2引数でクラス名を指定した場合は "binderAssets" に追加する形で連結される。
func (w *wrapper) assetsImage(v ...any) template.HTML {

	id, ok := Arg[string](v, 0).Required()
	if !ok {
		w.addWarning("assetsImage: missing id argument")
		return templateError("ERROR: assetsImage id")
	}
	//クラス名指定（空可）。常に "binderAssets" を先頭に付与する。
	clazz := Arg[string](v, 1).Default("")
	classAttr := "binderAssets"
	if strings.TrimSpace(clazz) != "" {
		classAttr = classAttr + " " + clazz
	}

	// エラー時は drawLayer と同様にプレビューへ可視のエラー文字列を返す
	// （壊れた src の <img> を出さない）
	src, err := w.assetURL("assetsImage", id)
	if err != nil {
		w.addWarning(fmt.Sprintf("assetsImage(%s): %v", id, err))
		return templateError(fmt.Sprintf("ERROR: assetsImage(%s): %v", id, err))
	}

	return template.HTML(fmt.Sprintf(`<img src="%s" class="%s">`, src, classAttr))
}

func (w *wrapper) childNotes(v ...any) []*tempNote {
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
		notes, err = w.owner.db.FindUpdatedNotes(id, limit, offset)
	} else {
		notes, err = w.owner.db.FindPublishNotes(id, limit, offset)
	}

	if err != nil {
		w.addWarning(fmt.Sprintf("childNotes(%s): %v", id, err))
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

	var err error
	var notes []*model.Note
	if w.Local {
		notes, err = w.owner.db.FindSeqNotes(id, limit, -1)
	} else {
		notes, err = w.owner.db.FindPublishSeqNotes(id, limit, -1)
	}
	if err != nil {
		w.addWarning(fmt.Sprintf("childNotes(%s, seq): %v", id, err))
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
			w.addWarning(fmt.Sprintf("breadcrumb(%s): GetStructure: %v", id, err))
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
	} else {
		w.addWarning(fmt.Sprintf("breadcrumb: GetStructure(index): %v", err))
	}
	// reverse: root→current
	for i, j := 0, len(chain)-1; i < j; i, j = i+1, j-1 {
		chain[i], chain[j] = chain[j], chain[i]
	}
	return chain
}

// prevNote は、ツリーの順で現在のノートの前のノートを返す。無ければ nil。
// 「前へ」「次へ」を作るためのもの。順番と引数は neighborNote を参照。
func (w *wrapper) prevNote(v ...any) *tempNote {
	return w.neighborNote("prevNote", -1, v...)
}

// nextNote は、ツリーの順で現在のノートの次のノートを返す。無ければ nil。
func (w *wrapper) nextNote(v ...any) *tempNote {
	return w.neighborNote("nextNote", 1, v...)
}

// neighborNote は、ツリーの順で現在のノートから step だけ離れたノートを返す。
//
// 順番は、起点のノートから深さ優先でたどった順（親の次に子、同じ親の中は seq 順）。
// 第1引数で起点のノートの ID を指定できる（省略時は "index" = バインダー全体）。起点のノート自身も順番に含む。
// ノート以外（ダイアグラム等）は数えないが、その下にあるノートはたどる。
// 非公開のノートは数えず、公開時は公開中のノートだけを数える（現在のノートは常に含める）。
// 現在のノートが起点の外にあるときは nil を返す。
func (w *wrapper) neighborNote(fn string, step int, v ...any) *tempNote {
	if w.note == nil {
		return nil
	}
	root := Arg[string](v, 0).Default("index")

	order, err := w.noteOrder(root)
	if err != nil {
		w.addWarning(fmt.Sprintf("%s(%s): %v", fn, root, err))
		return nil
	}
	for i, s := range order {
		if s.Id != w.note.Id {
			continue
		}
		j := i + step
		if j < 0 || j >= len(order) {
			return nil
		}
		return w.structureNote(fn, order[j])
	}
	return nil
}

// noteOrder は root から深さ優先でたどったノートの並びを返す（neighborNote の順番）。
func (w *wrapper) noteOrder(root string) ([]*model.Structure, error) {
	all, err := w.owner.db.FindStructures()
	if err != nil {
		return nil, xerrors.Errorf("FindStructures() error: %w", err)
	}

	byId := make(map[string]*model.Structure, len(all))
	children := make(map[string][]*model.Structure)
	for _, s := range all {
		byId[s.Id] = s
		children[s.ParentId] = append(children[s.ParentId], s)
	}
	for _, list := range children {
		sort.SliceStable(list, func(i, j int) bool { return list[i].Seq < list[j].Seq })
	}

	top, ok := byId[root]
	if !ok {
		return nil, xerrors.Errorf("structure not found: %s", root)
	}

	var order []*model.Structure
	visited := make(map[string]bool)
	var walk func(s *model.Structure)
	walk = func(s *model.Structure) {
		if visited[s.Id] {
			return
		}
		visited[s.Id] = true
		if s.Typ == "note" && w.countsInOrder(s) {
			order = append(order, s)
		}
		for _, c := range children[s.Id] {
			walk(c)
		}
	}
	walk(top)
	return order, nil
}

// countsInOrder は、ノートを「前へ」「次へ」の順番に数えるかを返す。
func (w *wrapper) countsInOrder(s *model.Structure) bool {
	if w.note != nil && s.Id == w.note.Id {
		return true
	}
	if s.Private {
		return false
	}
	// 公開時は公開中のノートだけ（取り下げると republish_date が空に戻る）
	if !w.Local && s.Republish.IsZero() {
		return false
	}
	return true
}

// structureNote は Structure からテンプレートに渡すノートを作る。
func (w *wrapper) structureNote(fn string, s *model.Structure) *tempNote {
	n, err := w.owner.db.GetNote(s.Id)
	if err != nil || n == nil {
		w.addWarning(fmt.Sprintf("%s: GetNote(%s): %v", fn, s.Id, err))
		jn := &json.Note{Id: s.Id, Name: s.Name, Detail: s.Detail, Alias: s.Alias}
		return w.convertNote(jn)
	}
	jn := n.To()
	jn.ApplyStructure(s.To())
	return w.convertNote(jn)
}

func (w *wrapper) drawSVG(v ...any) template.HTML {

	id, ok := Arg[string](v, 0).Required()
	if !ok {
		w.addWarning("drawDiagram: missing id argument")
		return templateError("ERROR: drawDiagram id")
	}
	clazz := Arg[string](v, 1).Default("")
	classAttr := "binderSVG"
	if strings.TrimSpace(clazz) != "" {
		classAttr = classAttr + " " + clazz
	}

	code := ""
	if w.Local {
		var d strings.Builder
		if err := w.owner.ReadDiagram(&d, id); err != nil {
			w.addWarning(fmt.Sprintf("drawDiagram(%s): ReadDiagram: %v", id, err))
			return templateError(fmt.Sprintf("ERROR: drawDiagram(%s): %v", id, err))
		}
		code = d.String()

		diag, err := w.owner.GetDiagram(id)
		if err != nil {
			w.addWarning(fmt.Sprintf("drawDiagram(%s): GetDiagram: %v", id, err))
			return templateError(fmt.Sprintf("ERROR: drawDiagram(%s): %v", id, err))
		}

		if parsed, err := w.owner.parseDiagram(diag, w.Local, code, w.warnings); err == nil {
			code = parsed
		} else {
			w.addWarning(fmt.Sprintf("drawDiagram(%s): ParseDiagram: %v", id, err))
		}

		if diag.StyleTemplate != "" {
			var sb strings.Builder
			if err := w.owner.ReadTemplate(&sb, diag.StyleTemplate); err == nil {
				code = fmt.Sprintf("%%%%{init:%s}%%%%\n%s", sb.String(), code)
			}
		}
	} else {

		diag, err := w.owner.GetDiagram(id)
		if err != nil {
			w.addWarning(fmt.Sprintf("drawDiagram(%s): GetDiagram: %v", id, err))
			code = fmt.Sprintf("ERROR: drawDiagram(%s): %v", id, err)
		} else {
			// 公開ページは公開済みの SVG を参照するため、図が未公開だと画像だけが 404 になる
			w.warnUnreachable("drawDiagram", id, diag.Private, diag.Republish)
			if w.deps != nil {
				w.deps.diagrams[id] = diag
			}
			code = fmt.Sprintf(`<img src="%s">`, w.convertURL(fs.SVGFile(diag)))
		}
	}

	if w.Local {
		encoded := base64.StdEncoding.EncodeToString([]byte(code))
		return template.HTML(fmt.Sprintf(
			"\n<div class=\"%s\" id=\"%s\" data-mermaid=\"%s\"></div>", classAttr, id, encoded))
	}
	return template.HTML(fmt.Sprintf(
		"\n<div class=\"%s\" id=\"%s\">%s</div>", classAttr, id, code))
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
		w.addWarning("drawLayer: missing id argument")
		return templateError("ERROR: drawLayer id")
	}
	// クラス名指定（省略可）
	clazz := Arg[string](v, 1).Default("")

	imageSrc := ""
	svgSrc := ""
	if w.Local {
		// 親Assetの画像を data URI で埋め込み、HTTPサーバに依存しない
		m, err := w.owner.GetLayerWithParent(id)
		if err != nil {
			w.addWarning(fmt.Sprintf("drawLayer(%s): GetLayerWithParent: %v", id, err))
			return templateError(fmt.Sprintf("ERROR: drawLayer(%s): %v", id, err))
		}
		if m.Parent != nil {
			uri, err := w.owner.AssetDataURI(m.Parent.Id)
			if err != nil {
				w.addWarning(fmt.Sprintf("drawLayer(%s): AssetDataURI: %v", id, err))
				return templateError(fmt.Sprintf("ERROR: drawLayer(%s): %v", id, err))
			}
			imageSrc = uri
		}
	} else {
		// 公開時は親 Asset の公開パスを参照
		m, err := w.owner.GetLayerWithParent(id)
		if err != nil {
			w.addWarning(fmt.Sprintf("drawLayer(%s): GetLayerWithParent: %v", id, err))
			return templateError(fmt.Sprintf("ERROR: drawLayer(%s): %v", id, err))
		}
		// 公開ページはレイヤーの SVG と下敷きの画像を公開パスで参照するため、どちらも公開済みでないと 404 になる
		w.warnUnreachable("drawLayer", id, m.Private, m.Republish)
		if m.Parent != nil {
			w.warnUnreachable("drawLayer", m.ParentId, m.Parent.Private, m.Parent.Republish)
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
		w.addWarning(fmt.Sprintf("drawLayer(%s): BuildLayerHTML: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: drawLayer(%s): %v", id, err))
	}
	return html
}

// embed は指定 ID のノートまたはテキストアセットの内容をインライン展開する。
// エラー時は warnings に記録し、HTMLにERRORプレフィックスを出力して処理を継続する。
// 呼び出しパス上に同じ ID が既に存在する場合は循環参照エラーとなる。
// structure で type を確認し、note と（テキスト）asset のみをサポートする。
// link はエントリIDからそのエントリへのリンク（<a>タグ）を生成するテンプレート関数。
// 第2引数を省略した場合はエントリ名をリンクテキストにする。
// 対象は note / diagram / layer / asset（テンプレートは公開ページを持たないため対象外）。
//
// プレビューでも公開時と同じ相対URLを返す。assets が Local で data URI を返すのは
// <img> に実体が必要だからで、リンクは行き先だけあればよい。こうすると公開HTMLでは
// そのままページ間リンクになり、プレビューではエディタ側でそのエントリを開く導線になる。
func (w *wrapper) link(v ...any) template.HTML {

	id, ok := Arg[string](v, 0).Required()
	if !ok {
		w.addWarning("link: missing id argument")
		return templateError("ERROR: link id")
	}

	s, err := w.owner.db.GetStructure(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("link(%s): GetStructure: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: link(%s): %v", id, err))
	}

	href, err := w.entryURL(s)
	if err != nil {
		w.addWarning(fmt.Sprintf("link(%s): %v", id, err))
		return templateError(fmt.Sprintf("ERROR: link(%s): %v", id, err))
	}

	w.warnUnreachable("link", id, s.Private, s.Republish)

	name := Arg[string](v, 1).Default("")
	if strings.TrimSpace(name) == "" {
		name = s.Name
	}

	return template.HTML(fmt.Sprintf(`<a href="%s">%s</a>`,
		template.HTMLEscapeString(href), template.HTMLEscapeString(name)))
}

// url はエントリIDから公開時のURLを返すテンプレート関数。
// <a> を組み立てる link と違い、URLだけが欲しい場面（<meta property="og:image">、
// 独自の属性を付けた <a>、CSS の url() 等）で使う。
//
// プレビューでも公開時と同じURLを返す。モードで別物にすると
// テンプレートを書く側が挙動を追えなくなるためで、代わりに未公開・非公開は警告する。
// プレビューの iframe はこのURLを読み込めないので、画像として使った場合は
// 壊れた画像ではなく「解決できない」と分かる表示に置き換わる（preview-unresolved.js）。
//
// なお marked が先に走る都合で、ノート本文の [x]({{ url ... }}) は成立しない。
// 本文からは link を、テンプレートからは url を使う。
func (w *wrapper) url(v ...any) template.URL {

	id, ok := Arg[string](v, 0).Required()
	if !ok {
		w.addWarning("url: missing id argument")
		return template.URL("ERROR: url id")
	}

	s, err := w.owner.db.GetStructure(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("url(%s): GetStructure: %v", id, err))
		return template.URL(fmt.Sprintf("ERROR: url(%s): %v", id, err))
	}

	href, err := w.entryURL(s)
	if err != nil {
		w.addWarning(fmt.Sprintf("url(%s): %v", id, err))
		return template.URL(fmt.Sprintf("ERROR: url(%s): %v", id, err))
	}

	w.warnUnreachable("url", id, s.Private, s.Republish)
	return template.URL(href)
}

// warnUnreachable は公開しても辿れないエントリを参照した場合に警告する。
// 参照自体は出すが、公開後に 403/404 になることは知らせる。
// プレビュー中は「まだ公開していない」のが通常の状態なので警告しない。
func (w *wrapper) warnUnreachable(fn string, id string, private bool, republish time.Time) {
	if w.Local {
		return
	}
	if private {
		w.addWarning(fmt.Sprintf("%s(%s): private entry", fn, id))
	} else if republish.IsZero() {
		w.addWarning(fmt.Sprintf("%s(%s): not published yet", fn, id))
	}
}

// entryURL は Structure から公開時の相対URLを返す。
// エクスポート時は参照した実体を依存関係として記録する（ノートは別ページのため対象外）。
func (w *wrapper) entryURL(s *model.Structure) (string, error) {

	switch s.Typ {
	case "note":
		n, err := w.owner.GetNote(s.Id)
		if err != nil {
			return "", xerrors.Errorf("GetNote() error: %w", err)
		}
		return w.convertURL(fs.HTMLFile(n)), nil

	case "diagram":
		d, err := w.owner.GetDiagram(s.Id)
		if err != nil {
			return "", xerrors.Errorf("GetDiagram() error: %w", err)
		}
		if w.deps != nil {
			w.deps.diagrams[s.Id] = d
		}
		return w.convertURL(fs.SVGFile(d)), nil

	case "layer":
		l, err := w.owner.GetLayerWithParent(s.Id)
		if err != nil {
			return "", xerrors.Errorf("GetLayerWithParent() error: %w", err)
		}
		if w.deps != nil {
			w.deps.layers[s.Id] = l
			if l.Parent != nil {
				w.deps.assets[l.ParentId] = l.Parent
			}
		}
		return w.convertURL(fs.PublicLayerFile(l)), nil

	case "asset":
		a, err := w.owner.GetAssetWithParent(s.Id)
		if err != nil {
			return "", xerrors.Errorf("GetAssetWithParent() error: %w", err)
		}
		if w.deps != nil {
			w.deps.assets[s.Id] = a
		}
		return w.convertURL(fs.PublicAssetFile(a)), nil
	}

	return "", xerrors.Errorf("unsupported type=%s", s.Typ)
}

func (w *wrapper) embed(id string) template.HTML {
	if w.visited[id] {
		w.addWarning(fmt.Sprintf("embed(%s): cycle detected", id))
		return templateError(fmt.Sprintf("ERROR: embed(%s): cycle detected", id))
	}

	s, err := w.owner.db.GetStructure(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): GetStructure: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	switch s.Typ {
	case "note":
		return w.embedNote(id)
	case "asset":
		return w.embedTextAsset(id)
	default:
		w.addWarning(fmt.Sprintf("embed(%s): unsupported type=%s", id, s.Typ))
		return templateError(fmt.Sprintf("ERROR: embed(%s): unsupported type=%s", id, s.Typ))
	}
}

// embedNote はノートの Markdown 本文をテンプレート処理してインライン展開する。
func (w *wrapper) embedNote(id string) template.HTML {
	note, err := w.owner.GetNote(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): GetNote: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	var buf strings.Builder
	if err := w.owner.ReadNote(&buf, id); err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): ReadNote: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	childWrap := &wrapper{
		owner:         w.owner,
		note:          note,
		Local:         w.Local,
		visited:       w.visitedWith(id),
		deps:          w.deps,
		exportAsIndex: w.exportAsIndex,
		warnings:      w.warnings,
	}

	content := buf.String()
	tmpl, err := texttemplate.New("").Funcs(texttemplate.FuncMap(defineFuncMap(childWrap))).Parse(content)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): Parse: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	dto, err := w.owner.createDto(childWrap, content)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): createDto: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	var out strings.Builder
	if err := tmpl.Execute(&out, dto); err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): Execute: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	return template.HTML(out.String())
}

// embedTextAsset はテキストアセットの内容をテンプレート処理してインライン展開する。
// バイナリアセットは対象外。親ノートのコンテキストを継承してテンプレート関数を使用できる。
func (w *wrapper) embedTextAsset(id string) template.HTML {
	a, err := w.owner.db.GetAsset(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): GetAsset: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}
	if a.Binary {
		w.addWarning(fmt.Sprintf("embed(%s): asset is binary", id))
		return templateError(fmt.Sprintf("ERROR: embed(%s): asset is binary", id))
	}

	data, _, err := w.owner.ReadAssetBytes(id)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): ReadAssetBytes: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	childWrap := &wrapper{
		owner:         w.owner,
		note:          w.note,
		Local:         w.Local,
		visited:       w.visitedWith(id),
		deps:          w.deps,
		exportAsIndex: w.exportAsIndex,
		warnings:      w.warnings,
	}

	content := string(data)
	tmpl, err := texttemplate.New("").Funcs(texttemplate.FuncMap(defineFuncMap(childWrap))).Parse(content)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): asset Parse: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	dto, err := w.owner.createDto(childWrap, content)
	if err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): asset createDto: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	var out strings.Builder
	if err := tmpl.Execute(&out, dto); err != nil {
		w.addWarning(fmt.Sprintf("embed(%s): asset Execute: %v", id, err))
		return templateError(fmt.Sprintf("ERROR: embed(%s): %v", id, err))
	}

	return template.HTML(out.String())
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
		log.Warnf("format error:%s\n%+v", d, e)
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
