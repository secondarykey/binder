package binder

import (
	"binder/api/json"
	"binder/convert"
	"binder/fs"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *json.Config) error {

	if b == nil {
		return EmptyError
	}

	meta, err := convert.LoadMeta(b.dir)
	if err != nil {
		return xerrors.Errorf("LoadMeta() error: %w", err)
	}

	meta.Name = conf.Name
	meta.Detail = conf.Detail

	if err = convert.SaveMeta(b.dir, meta); err != nil {
		return xerrors.Errorf("SaveMeta() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Update Config", "Main"), convert.BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) GetConfig() (*json.Config, error) {
	if b == nil {
		return nil, EmptyError
	}

	meta, err := convert.LoadMeta(b.dir)
	if err != nil {
		return nil, xerrors.Errorf("LoadMeta() error: %w", err)
	}

	var conf json.Config
	conf.Name = meta.Name
	conf.Detail = meta.Detail
	return &conf, nil
}
