package binder

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (b *Binder) EditTemplate(t *model.Template) (*model.Template, error) {

	if b == nil {
		return nil, EmptyError
	}

	if t.Id == "" {

		t.Id = b.generateId()
		err := b.createTemplate(t)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateTemplate() error: %w", err)
		}

	} else {
		err := b.db.UpdateTemplate(t, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateTemplate() error: %w", err)
		}
	}

	//TODO データベースコミット
	return t, nil
}

func (b *Binder) createTemplate(t *model.Template) error {
	err := b.fileSystem.CreateTemplateFile(t)
	if err != nil {
		return xerrors.Errorf("fs.CreteTemplateFile() error: %w", err)
	}
	err = b.db.InsertTemplate(t, b.op)
	if err != nil {
		return xerrors.Errorf("db.InsertTemplate() error: %w", err)
	}
	return nil
}

func (b *Binder) GetTemplate(id string) (*model.Template, error) {
	if b == nil {
		return nil, EmptyError
	}
	t, err := b.db.GetTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.GetTemplate() error: %w", err)
	}
	return t, nil
}

func (b *Binder) OpenTemplate(id string) ([]byte, error) {
	if b == nil {
		return nil, EmptyError
	}

	data, err := b.fileSystem.ReadTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadTemplate() error: %w", err)
	}
	return data, nil
}

func (b *Binder) SaveTemplate(id string, data []byte) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.WriteTemplate(id, data)
	if err != nil {
		return xerrors.Errorf("WriteTemplate() error: %w", err)
	}
	return nil
}

func (b *Binder) GetHTMLTemplates() ([]*model.Template, []*model.Template, error) {

	if b == nil {
		return nil, nil, EmptyError
	}

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
