package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) GetTemplate(id string) (*model.Template, error) {
	return b.db.GetTemplate(id)
}

func (b *Binder) OpenTemplate(id string) ([]byte, error) {
	return b.fileSystem.ReadTemplate(id)
}

func (b *Binder) SaveTemplate(id string, data []byte) error {

	err := b.fileSystem.WriteTemplate(id, data)
	if err != nil {
		return xerrors.Errorf("WriteTemplate() error: %w", err)
	}
	return nil
}

func (b *Binder) GetHTMLTemplates() ([]*model.Template, []*model.Template, error) {
	layouts, err := b.db.FindLayoutTemplates()
	if err != nil {
		return nil, nil, xerrors.Errorf("FindLayoutTemplates() error: %w", err)
	}
	contents, err := b.db.FindContentTemplates()
	if err != nil {
		return nil, nil, xerrors.Errorf("FindContentTemplates() error: %w", err)
	}
	return layouts, contents, nil
}
