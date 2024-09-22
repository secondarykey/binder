package binder

import (
	"fmt"
	"strings"

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
	return &http.Server{Handler: &h}, nil
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	url := r.URL.String()
	switch url {
	case "/search":
		//検索系
	case "/private":
		//公開前の表示
	default:
		h.fileServer.ServeHTTP(w, r)
	}
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
		log.Noticef("HTTPServer Listen: %s", b.httpServerAddress)
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
