package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

// ErrTemplateInUse はテンプレートがノートで使用中のため削除できない場合のエラー
type ErrTemplateInUse struct {
	NoteCount int
}

func (e *ErrTemplateInUse) Error() string {
	return fmt.Sprintf("このテンプレートは %d 件のノートで使用されているため削除できません", e.NoteCount)
}

func (b *Binder) EditTemplate(t *json.Template) (*json.Template, error) {

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

		m := model.ConvertTemplate(t)
		err := b.db.UpdateTemplate(m, b.op)
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

func (b *Binder) createTemplate(t *json.Template) (string, error) {

	fn, err := b.fileSystem.CreateTemplateFile(t)
	if err != nil {
		return "", xerrors.Errorf("fs.CreteTemplateFile() error: %w", err)
	}

	m := model.ConvertTemplate(t)
	err = b.db.InsertTemplate(m, b.op)
	if err != nil {
		return "", xerrors.Errorf("db.InsertTemplate() error: %w", err)
	}
	return fn, nil
}

func (b *Binder) RemoveTemplate(id string) (*json.Template, error) {

	if b == nil {
		return nil, EmptyError
	}

	// 利用中のノートが存在する場合は削除不可
	notes, err := b.db.FindNotesByTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotesByTemplate() error: %w", err)
	}
	if len(notes) > 0 {
		return nil, &ErrTemplateInUse{NoteCount: len(notes)}
	}

	// 利用中のダイアグラムが存在する場合は削除不可
	diagrams, err := b.db.FindDiagramsByTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagramsByTemplate() error: %w", err)
	}
	if len(diagrams) > 0 {
		return nil, &ErrTemplateInUse{NoteCount: len(diagrams)}
	}

	t, err := b.db.GetTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetTemplate() error: %w", err)
	}

	j := t.To()

	files, err := b.fileSystem.DeleteTemplateFile(j)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteTemplateFile() error: %w", err)
	}

	err = b.db.DeleteTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteTemplate() error: %w", err)
	}

	files = append(files, fs.TemplateTableFile())

	err = b.fileSystem.Commit(fs.M("Remove Template", j.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return j, nil
}

func (b *Binder) GetTemplate(id string) (*json.Template, error) {

	if b == nil {
		return nil, EmptyError
	}
	t, err := b.db.GetTemplate(id)
	if err != nil {
		return nil, xerrors.Errorf("fs.GetTemplate() error: %w", err)
	}

	j := t.To()
	err = b.fileSystem.SetTemplateStatus(j)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetTemplateStatus() error: %w", err)
	}
	return j, nil
}

func (b *Binder) ReadTemplate(w io.Writer, id string) error {

	if b == nil {
		return EmptyError
	}

	t, err := b.db.GetTemplate(id)
	if err != nil {
		return xerrors.Errorf("db.GetTemplate() error: %w", err)
	}

	j := t.To()
	err = b.fileSystem.ReadTemplate(w, j)
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

	j := t.To()
	_, err = b.fileSystem.WriteTemplate(j, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteTemplate() error: %w", err)
	}

	//fmt.Println(fn)

	return nil
}

// UpdateTemplateSeqs はIDリストの順序に従って各テンプレートのseqを更新し、1回でコミットする。
// ドラッグ＆ドロップによる並び替えUIから呼ばれる。
func (b *Binder) UpdateTemplateSeqs(ids []string) error {

	if b == nil {
		return EmptyError
	}

	for i, id := range ids {
		if err := b.db.UpdateTemplateSeq(id, i); err != nil {
			return xerrors.Errorf("db.UpdateTemplateSeq(%s, %d) error: %w", id, i, err)
		}
	}

	err := b.fileSystem.Commit(fs.M("Reorder Templates", "seq"), fs.TemplateTableFile())
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) GetHTMLTemplates() ([]*json.Template, []*json.Template, []*json.Template, error) {

	if b == nil {
		return nil, nil, nil, EmptyError
	}

	tmps, err := b.db.FindLayoutTemplates()
	if err != nil {
		return nil, nil, nil, xerrors.Errorf("FindLayoutTemplates() error: %w", err)
	}
	layouts := make([]*json.Template, len(tmps))
	for idx, t := range tmps {
		layouts[idx] = t.To()
	}

	tmps, err = b.db.FindContentTemplates()
	if err != nil {
		return nil, nil, nil, xerrors.Errorf("FindContentTemplates() error: %w", err)
	}
	contents := make([]*json.Template, len(tmps))
	for idx, t := range tmps {
		contents[idx] = t.To()
	}

	tmps, err = b.db.FindDiagramTemplates()
	if err != nil {
		return nil, nil, nil, xerrors.Errorf("FindDiagramTemplates() error: %w", err)
	}
	diagrams := make([]*json.Template, len(tmps))
	for idx, t := range tmps {
		diagrams[idx] = t.To()
	}

	return layouts, contents, diagrams, nil
}
