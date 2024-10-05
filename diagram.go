package binder

import (
	"binder/db/model"
	"binder/fs"
	"io"

	"golang.org/x/xerrors"
)

func (b *Binder) EditDiagram(d *model.Diagram) (*model.Diagram, error) {

	if b == nil {
		return nil, EmptyError
	}

	var prefix string
	var files []string

	//新規指定だった場合
	if d.Id == "" {

		d.Id = b.generateId()
		d.Alias = d.Id

		f, err := b.fileSystem.CreateDiagramFile(d)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateDiagramFile() error: %w", err)
		}
		files = append(files, f)

		//DB設定
		err = b.db.InsertDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertDiagram() error: %w", err)
		}

		prefix = "Create Diagram"
	} else {

		old, err := b.db.GetDiagram(d.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
		}

		if old.Alias != d.Alias {
			// TODO Alias変更の処理を行う
			// 現在公開中のものを新規の場所にコピー
		}

		err = b.db.UpdateDiagram(d, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateDiagram() error: %w", err)
		}

		prefix = "Edit Diagram"
	}

	files = append(files, fs.DiagramTableFile())
	//コミット
	err := b.fileSystem.Commit(fs.M(prefix, d.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return d, nil
}

func (b *Binder) GetDiagram(id string) (*model.Diagram, error) {
	if b == nil {
		return nil, EmptyError
	}
	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}
	err = b.fileSystem.SetDiagramStatus(d)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetDiagramStatus() error: %w", err)
	}

	return d, nil
}

func (b *Binder) ReadDiagram(w io.Writer, id string) error {
	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.ReadDiagram(w, id)
	if err != nil {
		return xerrors.Errorf("fs.ReadDiagram() error: %w", err)
	}
	return nil
}

func (b *Binder) SaveDiagram(id string, data []byte) error {

	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.WriteDiagram(id, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteDiagram() error: %w", err)
	}

	return nil
}

func (b *Binder) RemoveDiagram(id string) (*model.Diagram, error) {

	if b == nil {
		return nil, EmptyError
	}

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	//ファイルを削除
	files, err := b.fileSystem.DeleteDiagram(d)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteDiagram() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}

	fn := fs.DiagramTableFile()
	files = append(files, fn)

	//コミット
	err = b.fileSystem.Commit(fs.M("Remove Diagram", d.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return d, nil
}

func (b *Binder) GetUnpublishedDiagrams() ([]*model.Diagram, error) {

	all, err := b.db.FindDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}

	pr := make([]*model.Diagram, 0, len(all))

	for _, d := range all {

		err = b.fileSystem.SetDiagramStatus(d)
		if err != nil {
			return nil, xerrors.Errorf("SetDiagramStatus() error: %w", err)
		}

		//最新じゃない場合は追加
		if d.PublishStatus != model.LatestStatus {
			pr = append(pr, d)
		}
	}
	return pr, nil
}

func (b *Binder) PublishDiagram(id string, data []byte) (*model.Diagram, error) {

	var files []string

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	if d.Publish.IsZero() {
		//TODO Publish dateがない場合
		// files にデータベースを追加
	}

	fn, err := b.fileSystem.PublishDiagram(data, d)
	if err != nil {
		return nil, xerrors.Errorf("fs.PublishNote() error: %w", err)
	}

	files = append(files, fn)
	//コミット
	err = b.fileSystem.Commit(fs.M("Publish Diagram", d.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return d, nil
}
