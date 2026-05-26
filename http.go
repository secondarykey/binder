package binder

import (
	"bytes"
	"fmt"
	"html/template"
	"strconv"
	"strings"
	"time"

	stdFs "io/fs"
	"net"
	"net/http"

	binderFs "binder/fs"
	"binder/log"

	"golang.org/x/xerrors"
)

// errorPageTmpl はカスタムエラーページのHTMLテンプレート
var errorPageTmpl = template.Must(template.New("error").Parse(`<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>{{.Code}}</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5}
.box{text-align:center;padding:2rem;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
h1{font-size:4rem;margin:0;color:#ccc}p{color:#555;font-size:1.1rem}</style>
</head>
<body><div class="box"><h1>{{.Code}}</h1><p>{{.Message}}</p></div></body>
</html>`))

func writeErrorPage(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(code)
	_ = errorPageTmpl.Execute(w, struct {
		Code    int
		Message string
	}{code, message})
}

// outdatedBanner は最新版でない旨を知らせる固定バナーを注入するスクリプト
var outdatedBanner = []byte(`<script>(function(){` +
	`var b=document.createElement('div');` +
	`b.style.cssText='position:fixed;top:0;left:0;right:0;background:#f57c00;color:#fff;` +
	`padding:8px 16px;text-align:center;font-family:sans-serif;font-size:14px;` +
	`z-index:99999;box-shadow:0 2px 4px rgba(0,0,0,.3);cursor:pointer';` +
	`b.textContent='最新版ではありません（公開処理を行うと最新版になります）';` +
	`b.onclick=function(){b.style.display='none'};` +
	`document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(b)});` +
	`})()</script>`)

// responseCapture は http.FileServer のレスポンスを一旦バッファに捕捉する
type responseCapture struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (rc *responseCapture) Header() http.Header         { return rc.header }
func (rc *responseCapture) WriteHeader(code int)        { rc.status = code }
func (rc *responseCapture) Write(b []byte) (int, error) { return rc.body.Write(b) }

// injectBanner はHTMLボディの </body> 直前にバナーを挿入して返す
func injectBanner(body []byte) []byte {
	if idx := bytes.LastIndex(body, []byte("</body>")); idx >= 0 {
		result := make([]byte, 0, len(body)+len(outdatedBanner))
		result = append(result, body[:idx]...)
		result = append(result, outdatedBanner...)
		result = append(result, body[idx:]...)
		return result
	}
	return append(body, outdatedBanner...)
}

type aliasInfo struct {
	typ   string
	alias string
}

// parseAliasFromPath はリクエストパスからエンティティ種別とエイリアスを抽出する。
// 対象外のパスは nil を返す。
func parseAliasFromPath(path string) *aliasInfo {
	switch {
	case strings.HasPrefix(path, "/pages/") && strings.HasSuffix(path, ".html"):
		alias := strings.TrimSuffix(strings.TrimPrefix(path, "/pages/"), ".html")
		return &aliasInfo{typ: "note", alias: alias}
	case strings.HasPrefix(path, "/images/") && strings.HasSuffix(path, ".svg"):
		alias := strings.TrimSuffix(strings.TrimPrefix(path, "/images/"), ".svg")
		return &aliasInfo{typ: "diagram", alias: alias}
	case strings.HasPrefix(path, "/layers/") && strings.HasSuffix(path, ".svg"):
		alias := strings.TrimSuffix(strings.TrimPrefix(path, "/layers/"), ".svg")
		return &aliasInfo{typ: "layer", alias: alias}
	case strings.HasPrefix(path, "/assets/"):
		alias := strings.TrimPrefix(path, "/assets/")
		if alias == "" {
			return nil
		}
		return &aliasInfo{typ: "asset", alias: alias}
	}
	return nil
}

type BinderHandler struct {
	URL         string
	fileHandler http.Handler
	//debugHandler http.FileSystem
}

func NewBinderHandler() *BinderHandler {
	var h BinderHandler
	return &h
}

func (h *BinderHandler) ClearFS() {
	h.fileHandler = nil
}

func (h *BinderHandler) SetFS(b *Binder, pub string) error {

	docs, err := stdFs.Sub(b.fileSystem, pub)
	if err != nil {
		return xerrors.Errorf("[%s] error: %w", pub, err)
	}
	h.fileHandler = http.StripPrefix("/binder", http.FileServer(http.FS(docs)))
	return nil
}

func (h *BinderHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {

	if h.fileHandler == nil {
		//NotFound
		return
	}

	if h.URL == "" {
		h.URL = parseAddress(r.URL.String())
	}

	url := r.URL.Path

	fmt.Printf("Address:[%s]\n", url)

	switch url {
	case "/search":
		return
	default:
	}

	h.fileHandler.ServeHTTP(w, r)
}

func parseAddress(url string) string {
	if strings.Index(url, "http://") == -1 {
		return ""
	}
	// "http://" 以降を取得
	work := url[7:]
	idx := strings.Index(work, "/")
	if idx == -1 {
		return url
	}

	return url[:7+idx]
}

type handler struct {
	fileServer http.Handler
	binder     *Binder // プライベートアセット配信用
}

func (b *Binder) newHTTPServer() (*http.Server, error) {

	if b == nil {
		return nil, EmptyError
	}

	pub := b.fileSystem.GetPublic()
	docs, err := stdFs.Sub(b.fileSystem, pub)
	if err != nil {
		return nil, xerrors.Errorf("docs error: %w", err)
	}
	var h handler
	h.fileServer = http.FileServer(http.FS(docs))
	h.binder = b
	return &http.Server{Handler: &h}, nil
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	switch {
	case path == "/search":
		//検索系
	case path == "/private":
		//公開前の表示
	case strings.HasPrefix(path, "/binder-assets/"):
		// プレビュー用プライベートアセット配信
		id := strings.TrimPrefix(path, "/binder-assets/")
		h.servePrivateAsset(w, r, id)
	case strings.HasPrefix(path, "/binder-meta/"):
		// ノートメタ画像配信
		noteId := strings.TrimPrefix(path, "/binder-meta/")
		h.serveNoteMetaImage(w, r, noteId)
	default:
		h.serveWithAliasCheck(w, r)
	}
}

// serveWithAliasCheck はエンティティURLのエイリアス状態をDBで確認し、
// 状態に応じたカスタムエラーページを返す。通常ファイルはそのままfileServerへ委譲する。
func (h *handler) serveWithAliasCheck(w http.ResponseWriter, r *http.Request) {
	info := parseAliasFromPath(r.URL.Path)
	if info == nil || h.binder == nil || h.binder.db == nil {
		h.fileServer.ServeHTTP(w, r)
		return
	}

	s, err := h.binder.db.FindStructureByAlias(info.alias, info.typ)
	if err != nil {
		log.Warn("FindStructureByAlias(%s,%s): %v", info.alias, info.typ, err)
		h.fileServer.ServeHTTP(w, r)
		return
	}

	if s == nil {
		writeErrorPage(w, http.StatusNotFound, "存在しません(404)")
		return
	}

	if s.Private {
		writeErrorPage(w, http.StatusForbidden, "非公開のページです(403)")
		return
	}

	if s.Republish.IsZero() {
		writeErrorPage(w, http.StatusNotFound, "まだ公開処理を行っていません(404)")
		return
	}

	// 最新版チェック: structure更新日またはソースファイルModTimeがrepublishより新しい場合
	if info.typ == "note" && h.isOutdated(s.Republish, s.Updated, binderFs.NoteFile(s.Id)) {
		h.serveWithBanner(w, r)
		return
	}

	h.fileServer.ServeHTTP(w, r)
}

// isOutdated はDB上の更新日またはソースファイルのModTimeでoutdatedを判定する
func (h *handler) isOutdated(republish, structureUpdated time.Time, srcFile string) bool {
	if structureUpdated.After(republish) {
		return true
	}
	if h.binder != nil && h.binder.fileSystem != nil {
		fi, err := h.binder.fileSystem.Stat(srcFile)
		if err == nil && fi.ModTime().After(republish) {
			return true
		}
	}
	return false
}

// serveWithBanner はfileServerのHTMLレスポンスを捕捉し、最新版でない旨のバナーを注入して返す
func (h *handler) serveWithBanner(w http.ResponseWriter, r *http.Request) {
	rc := &responseCapture{header: make(http.Header)}
	h.fileServer.ServeHTTP(rc, r)

	body := injectBanner(rc.body.Bytes())

	for k, v := range rc.header {
		for _, vv := range v {
			w.Header().Add(k, vv)
		}
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	if rc.status != 0 {
		w.WriteHeader(rc.status)
	}
	_, _ = w.Write(body)
}

// servePrivateAsset はプライベートアセットをIDで配信する（エディタプレビュー用）
func (h *handler) servePrivateAsset(w http.ResponseWriter, r *http.Request, id string) {
	if h.binder == nil || id == "" {
		http.NotFound(w, r)
		return
	}

	data, meta, err := h.binder.ReadAssetBytes(id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Mimeフィールドが設定されていればそれを優先する。
	// 未設定の場合はAliasの拡張子から判定する（Nameは表示名で拡張子を持つとは限らないため）。
	if meta.Mime != "" {
		w.Header().Set("Content-Type", meta.Mime)
	}
	name := meta.Alias
	if name == "" {
		name = meta.Name
	}
	http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
}

// serveNoteMetaImage はノートのメタ画像（assets/meta/{noteId}）を配信する（エディタ表示用）
func (h *handler) serveNoteMetaImage(w http.ResponseWriter, r *http.Request, noteId string) {
	if h.binder == nil || noteId == "" {
		http.NotFound(w, r)
		return
	}

	data, err := h.binder.ReadMetaBytes(noteId)
	if err != nil || data == nil {
		http.NotFound(w, r)
		return
	}

	// ノートIDをファイル名として Content-Type を自動判定して配信
	http.ServeContent(w, r, noteId, time.Time{}, bytes.NewReader(data))
}

func (b *Binder) Serve() error {

	if b == nil {
		return EmptyError
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return xerrors.Errorf("net.Listen() error: %w", err)
	}

	b.httpServerAddress = ln.Addr().String()
	b.httpServer, err = b.newHTTPServer()
	if err != nil {
		return xerrors.Errorf("newHTTPServer() error: %w", err)
	}

	go func() {
		log.Notice("HTTPServer Listen: %s", b.httpServerAddress)
		err := b.httpServer.Serve(ln)
		if err != nil {
			//nilになってない場合、Shutdownの流れではない
			if b.httpServer != nil {
				log.PrintStackTrace(err)
			}
		}
	}()

	return nil
}

func (b *Binder) ServerAddress() string {
	if b == nil {
		return ""
	}
	return b.httpServerAddress
}
