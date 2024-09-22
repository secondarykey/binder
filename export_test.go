package binder

import (
	"binder/db"
	"binder/fs"
)

func (b *Binder) GetDB() *db.Instance {
	return b.db
}

func (b *Binder) GetFS() *fs.FileSystem {
	return b.fileSystem
}
