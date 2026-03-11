package binder

import (
	"binder/api/json"
	"binder/fs"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *json.Config) error {

	if b == nil {
		return EmptyError
	}

	meta, err := fs.LoadMeta(b.dir)
	if err != nil {
		return xerrors.Errorf("fs.LoadMeta() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	meta.Name = conf.Name
	meta.Detail = conf.Detail

	if err = fs.SaveMeta(b.dir, meta); err != nil {
		return xerrors.Errorf("fs.SaveMeta() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Update Config", "Main"), fs.BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) GetConfig() (*json.Config, error) {
	if b == nil {
		return nil, EmptyError
	}

	meta, err := fs.LoadMeta(b.dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.LoadMeta() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	var conf json.Config
	conf.Name = meta.Name
	conf.Detail = meta.Detail
	return &conf, nil
}
