package binder

import (
	"binder/db/model"
	"binder/fs"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

func (b *Binder) EditTemplate(t *model.Template) (*model.Template, error) {

	if b == nil {
		return nil, EmptyError
	}

	var prefix = ""
	var files []string

	if t.Id == "" {

		t.Id = b.generateId()
		fn, err := b.createTemplate(t)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateTemplate() error: %w", err)
		}

		files = append(files, fn)
		prefix = "Create Template"

	} else {
		err := b.db.UpdateTemplate(t, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateTemplate() error: %w", err)
		}
		prefix = "Update Template"
	}

	fn := fs.TemplateTableFile()
	files = append(files, fn)

	err := b.fileSystem.Commit(fs.M(prefix, t.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return t, nil
}

func (b *Binder) createTemplate(t *model.Template) (string, error) {

	fn, err := b.fileSystem.CreateTemplateFile(t)
	if err != nil {
		return "", xerrors.Errorf("fs.CreteTemplateFile() error: %w", err)
	}
	err = b.db.InsertTemplate(t, b.op)
	if err != nil {
		return "", xerrors.Errorf("db.InsertTemplate() error: %w", err)
	}
	return fn, nil
}

func (b *Binder) GetTemplate(id string) (*model.Template, error) {
	if b == nil {
		return nil, EmptyError
	}
	t, err := b.db.GetTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.GetTemplate() error: %w", err)
	}
	err = b.fileSystem.SetTemplateStatus(t)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetTemplateStatus() error: %w", err)
	}
	return t, nil
}

func (b *Binder) ReadTemplate(w io.Writer, id string) error {

	if b == nil {
		return EmptyError
	}

	t, err := b.db.GetTemplate(id)
	if err != nil {
		return xerrors.Errorf("db.GetTemplate() error: %w", err)
	}

	err = b.fileSystem.ReadTemplate(w, t)
	if err != nil {
		return xerrors.Errorf("fs.ReadTemplate() error: %w", err)
	}
	return nil
}

func (b *Binder) SaveTemplate(id string, data []byte) error {

	if b == nil {
		return EmptyError
	}

	t, err := b.db.GetTemplate(id)
	if err != nil {
		return xerrors.Errorf("db.GetTemplate() error: %w", err)
	}

	fn, err := b.fileSystem.WriteTemplate(t, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteTemplate() error: %w", err)
	}

	//TODO コミット
	fmt.Println(fn)

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
