package binder

import (
	"binder/db"
	"binder/fs"
	"net/http"
)

func (b *Binder) GetDB() *db.Instance {
	return b.db
}

func (b *Binder) GetFS() *fs.FileSystem {
	return b.fileSystem
}

// PreviewHandler は公開データを確認するプレビューサーバのハンドラを返す
func (b *Binder) PreviewHandler() (http.Handler, error) {
	s, err := b.newHTTPServer()
	if err != nil {
		return nil, err
	}
	return s.Handler, nil
}
