package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *json.Config) error {

	if b == nil {
		return EmptyError
	}

	m := model.ConvertConfig(conf)
	err := b.db.UpdateConfig(m, b.op)
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

func (b *Binder) GetConfig() (*json.Config, error) {
	if b == nil {
		return nil, EmptyError
	}

	c, err := b.db.GetConfig()
	if err != nil {
		return nil, xerrors.Errorf("db.GetConfig() error: %w", err)
	}

	return c.To(), nil
}
