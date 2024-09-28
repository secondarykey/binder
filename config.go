package binder

import (
	"binder/db/model"
	"binder/fs"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *model.Config) error {

	if b == nil {
		return EmptyError
	}

	err := b.db.UpdateConfig(conf, b.op)
	if err != nil {
		return xerrors.Errorf("db.UpdateConfig() error: %w", err)
	}

	fn := fs.ConfigTableFile()
	err = b.fileSystem.Commit(fs.M("Update Config", "Main"), fn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) GetConfig() (*model.Config, error) {
	if b == nil {
		return nil, EmptyError
	}
	c, err := b.db.GetConfig()
	if err != nil {
		return nil, xerrors.Errorf("db.GetConfig() error: %w", err)
	}
	return c, nil
}
