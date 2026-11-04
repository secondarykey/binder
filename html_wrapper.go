package binder

import (
	"fmt"
	"html/template"
	"strings"
	"time"

	"binder/api/json"
	"binder/fs"
)

// exportDeps はエクスポート時にテンプレート実行中に参照されたリソースを収集する。
type exportDeps struct {
	assets   map[string]*json.Asset
	diagrams map[string]*json.Diagram
	layers   map[string]*json.Layer
}

func (d *exportDeps) merge(other *exportDeps) {
	if other == nil {
		return
	}
	for k, v := range other.assets {
		d.assets[k] = v
	}
	for k, v := range other.diagrams {
		d.diagrams[k] = v
	}
	for k, v := range other.layers {
		d.layers[k] = v
	}
}

type wrapper struct {
	owner         *Binder
	note          *json.Note
	Local         bool
	visited       map[string]bool // embed で現在展開中のIDセット（循環参照防止）
	deps          *exportDeps     // nil = 通常モード、非nil = 依存関係収集モード
	exportAsIndex bool            // true の場合 relativePrefix() は常に "./" を返す
	warnings      *[]string       // テンプレート関数実行中のエラーを蓄積（親子wrapper間で共有）

	// page は URL の基準になる、いま書き出しているページのノート。nil なら note。
	// embed で別のノートを展開しても、相対パスは埋め込み先のページの位置で決まるため note とは分ける
	page *json.Note
	// siteRoot は 404 ページの URL の基準（サイトのルートからのパス。例: "/repo/"）。初回に求めて親子で共有する
	siteRoot *siteRootPath
}

// siteRootPath は 404 ページの URL の基準のキャッシュ。
type siteRootPath struct {
	done bool
	path string // 分からなければ空
}

func (w *wrapper) addWarning(msg string) {
	if w.warnings != nil {
		*w.warnings = append(*w.warnings, msg)
	}
}

func (w *wrapper) getWarnings() []string {
	if w.warnings == nil {
		return nil
	}
	return *w.warnings
}

// visitedWith は現在の visited に id を加えた新しいマップを返す。
// embed の子 wrapper に渡すことで呼び出しスタック上のIDを追跡する。
func (w *wrapper) visitedWith(id string) map[string]bool {
	next := make(map[string]bool, len(w.visited)+1)
	for k := range w.visited {
		next[k] = true
	}
	next[id] = true
	return next
}

func newWrapper(o *Binder, local bool, note *json.Note) (*wrapper, error) {
	ws := make([]string, 0)
	var w wrapper
	w.owner = o
	w.Local = local
	w.note = note
	w.warnings = &ws
	return &w, nil
}

func (w *wrapper) localAddr() string {
	return fmt.Sprintf("http://%s", w.owner.ServerAddress())
}

// relativePrefix は公開HTMLでのリソース参照用の相対パスプレフィックスを返す。
// index.html は docs/ 直下にあるため "./"、サブページは docs/pages/ 配下にあるため "../"。
//
// 404 ページ（docs/404.html）はアクセスされた URL のまま返されるため、相対パスでは階層によって壊れる。
// 公開時はサイトのルートからのパス（"/repo/"）を返す。プレビュー（Local）は docs 直下と同じ "./"。
// サイトの URL が分からなければ "./" にして警告する（1 階層目のパスで出たときだけ正しく表示される）。
func (w *wrapper) relativePrefix() string {
	if w.exportAsIndex {
		return "./"
	}
	page := w.pageNote()
	if page.IsErrorPage() {
		if w.Local {
			return "./"
		}
		if root := w.siteRootPath(); root != "" {
			return root
		}
		return "./"
	}
	if page != nil && page.Id != "index" {
		return "../"
	}
	return "./"
}

// pageNote は URL の基準になる、いま書き出しているページのノートを返す。
func (w *wrapper) pageNote() *json.Note {
	if w.page != nil {
		return w.page
	}
	return w.note
}

// siteRootCache は 404 ページの URL の基準のキャッシュを返す（embed の子 wrapper と共有する）。
func (w *wrapper) siteRootCache() *siteRootPath {
	if w.siteRoot == nil {
		w.siteRoot = &siteRootPath{}
	}
	return w.siteRoot
}

// siteRootPath はサイトの URL のパス部分（"https://u.github.io/repo/" → "/repo/"）を返す。
// 分からなければ空を返し、一度だけ警告する。
func (w *wrapper) siteRootPath() string {
	w.siteRootCache()
	if w.siteRoot.done {
		return w.siteRoot.path
	}
	w.siteRoot.done = true
	w.siteRoot.path = siteURLPath(w.owner.SiteURL())
	if w.siteRoot.path == "" {
		w.addWarning("404 page: site URL is unknown (set it in the binder settings); links work only for missing pages directly under the site root")
	}
	return w.siteRoot.path
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

	// メタ画像URL: ローカルプレビュー時は data URI で埋め込み、HTTPサーバに依存しない
	if w.Local {
		uri, err := w.owner.MetaImageDataURI(n.Id)
		if err != nil {
			w.addWarning(fmt.Sprintf("convertNote(%s): MetaImageDataURI: %v", n.Id, err))
		} else {
			t.Image = template.URL(uri)
		}
	} else {
		m := fs.PublicMetaFile(n)
		t.Image = template.URL(w.convertURL(m))
	}

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
