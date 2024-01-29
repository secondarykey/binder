package binder

import (
	"binder/fs"

	stdFs "io/fs"
	"log"
	"net"
	"net/http"

	"golang.org/x/xerrors"
)

func (b *Binder) Serve() error {

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return xerrors.Errorf("net.Listen() error: %w", err)
	}

	docs, err := stdFs.Sub(b.fileSystem, fs.PublishDir)
	if err != nil {
		return xerrors.Errorf("docs error: %w", err)
	}

	b.httpServerAddress = ln.Addr().String()
	b.httpServer = &http.Server{Handler: http.FileServer(http.FS(docs))}

	go func() {
		err := b.httpServer.Serve(ln)
		if err != nil {
			if b.httpServer != nil {
				log.Printf("local http Server Serve() error: %+v", err)
			}
		}
	}()

	return nil
}

func (b *Binder) ServerAddress() string {
	return b.httpServerAddress
}
