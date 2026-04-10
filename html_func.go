package binder

import (
	"fmt"
	"html/template"
	"strings"
	"time"

	"binder/db/model"
	"binder/fs"
	"binder/log"

	"golang.org/x/xerrors"
)

func defineFuncMap(w *wrapper) map[string]interface{} {
	funcMap := map[string]interface{}{
		"embed":         w.embed,
		"drawDiagram":   w.drawSVG,
		"assets":        w.assets,
		"assetsImage":   w.assetsImage,
		"childrenNotes": w.childrenNotes,
		"latestNotes":   w.latestNotes,
		"safe":          safeTemplate,
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

	p := fs.PublicAssetFile(a)
	return w.convertURL(p)
}

// assetsImage はアセットIDから <img> タグを生成するテンプレート関数
func (w *wrapper) assetsImage(v ...any) template.HTML {

	//アセットId
	id, ok := Arg[string](v, 0).Required()
	if !ok {
		return template.HTML(fmt.Sprintf(`assets id error`))
	}
	//クラス名指定
	clazz := Arg[string](v, 1).Default("")

	src := w.assets(id)

	return template.HTML(fmt.Sprintf(`<img src="%s" class="%s">`, src, clazz))
}

func (w *wrapper) childrenNotes(v ...any) []*tempNote {
	//件数
	n := Arg[int](v, 0).Default(-1)
	//指定ノートId
	id := Arg[string](v, 1).Default(w.note.Id)
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
