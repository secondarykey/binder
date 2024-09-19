package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *model.Config) error {
	if b == nil {
		return EmptyError
	}
	org, err := b.db.GetConfig()
	if err != nil {
		return xerrors.Errorf("db.GetConfig() error: %w", err)
	}
	conf.Created = org.Created

	err = b.db.UpdateConfig(conf, b.op)
	if err != nil {
		return xerrors.Errorf("db.UpdateConfig() error: %w", err)
	}

	//TODO Binder コミット
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
