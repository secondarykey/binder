package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *model.Config) error {
	org, err := b.db.GetConfig()
	if err != nil {
		return xerrors.Errorf("db.GetConfig() error: %w", err)
	}
	conf.Created = org.Created

	err = b.db.UpdateConfig(conf)
	if err != nil {
		return xerrors.Errorf("db.UpdateConfig() error: %w", err)
	}
	return nil
}

func (b *Binder) GetConfig() (*model.Config, error) {
	return b.db.GetConfig()
}
