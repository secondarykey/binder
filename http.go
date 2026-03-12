package binder

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	stdFs "io/fs"
	"net"
	"net/http"

	"binder/log"

	"golang.org/x/xerrors"
)

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
		h.fileServer.ServeHTTP(w, r)
	}
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

	// ファイル名からContent-Typeを自動判定して配信
	http.ServeContent(w, r, meta.Name, time.Time{}, bytes.NewReader(data))
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
		log.Notice(fmt.Sprintf("HTTPServer Listen: %s", b.httpServerAddress))
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
