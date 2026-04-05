package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"errors"
	"io"
	"time"

	"golang.org/x/xerrors"
)

func (b *Binder) EditDiagram(d *json.Diagram) (*json.Diagram, error) {

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

		m := model.ConvertDiagram(d)
		//DB設定
		err = b.db.InsertDiagram(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertDiagram() error: %w", err)
		}

		// Structure作成
		err = b.createStructure(d.Id, d.ParentId, "diagram", d.Name, d.Detail, d.Alias)
		if err != nil {
			return nil, xerrors.Errorf("createStructure() error: %w", err)
		}

		prefix = "Create Diagram"
	} else {

		_, err := b.db.GetDiagram(d.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
		}

		// alias変更時に公開済みファイルをリネーム
		oldS, err := b.db.GetStructure(d.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
		}
		if oldS.Alias != d.Alias {
			renamedFiles, err := b.fileSystem.RenamePublishedDiagram(oldS.Alias, d.Alias)
			if err != nil {
				return nil, xerrors.Errorf("fs.RenamePublishedDiagram() error: %w", err)
			}
			files = append(files, renamedFiles...)
		}

		m := model.ConvertDiagram(d)
		err = b.db.UpdateDiagram(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateDiagram() error: %w", err)
		}

		// Structure更新
		err = b.updateStructure(d.Id, d.ParentId, d.Name, d.Detail, d.Alias)
		if err != nil {
			return nil, xerrors.Errorf("updateStructure() error: %w", err)
		}

		prefix = "Edit Diagram"
	}

	files = append(files, fs.DiagramTableFile(), fs.StructureTableFile())
	//コミット
	err := b.fileSystem.Commit(fs.M(prefix, d.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return d, nil
}

func (b *Binder) GetDiagram(id string) (*json.Diagram, error) {
	if b == nil {
		return nil, EmptyError
	}
	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	m := d.To()

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}
	m.ApplyStructure(s.To())

	err = b.fileSystem.SetDiagramStatus(m)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetDiagramStatus() error: %w", err)
	}

	return m, nil
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

func (b *Binder) RemoveDiagram(id string) (*json.Diagram, error) {

	if b == nil {
		return nil, EmptyError
	}

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	m := d.To()
	m.ApplyStructure(s.To())

	//ファイルを削除
	files, err := b.fileSystem.DeleteDiagram(m)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteDiagram() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}

	err = b.db.DeleteStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteStructure() error: %w", err)
	}

	files = append(files, fs.DiagramTableFile(), fs.StructureTableFile())

	//コミット
	err = b.fileSystem.Commit(fs.M("Remove Diagram", m.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return m, nil
}

func (b *Binder) GetUnpublishedDiagrams() ([]*json.Diagram, error) {

	all, err := b.db.FindDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}

	// Structure情報を取得
	ids := make([]interface{}, len(all))
	for i, d := range all {
		ids[i] = d.Id
	}
	structMap, err := b.getStructureMap(ids...)
	if err != nil {
		return nil, xerrors.Errorf("getStructureMap() error: %w", err)
	}

	pr := make([]*json.Diagram, 0, len(all))

	for _, d := range all {

		m := d.To()
		if s, ok := structMap[d.Id]; ok {
			m.ApplyStructure(s.To())
		}

		err = b.fileSystem.SetDiagramStatus(m)
		if err != nil {
			return nil, xerrors.Errorf("SetDiagramStatus() error: %w", err)
		}

		//最新じゃない場合は追加
		if m.PublishStatus != json.LatestStatus {
			pr = append(pr, m)
		}
	}
	return pr, nil
}

func (b *Binder) PublishDiagram(id string, data []byte) (*json.Diagram, error) {

	var files []string

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	m := d.To()

	// publish/republish タイムスタンプを設定
	if s.Publish.IsZero() {
		// 初回公開: publish/republish 両方に現在時刻を設定
		now := time.Now()
		s.Publish = now
		s.Republish = now
	} else {
		// 再公開: republish のみ更新
		s.Republish = time.Now()
	}
	err = b.db.UpdateStructure(s, b.op)
	if err != nil {
		return nil, xerrors.Errorf("db.UpdateStructure() error: %w", err)
	}
	m.ApplyStructure(s.To())

	files = append(files, fs.StructureTableFile())

	fn, err := b.fileSystem.PublishDiagram(data, m)
	if err != nil {
		return nil, xerrors.Errorf("fs.PublishNote() error: %w", err)
	}

	files = append(files, fn)
	//コミット
	err = b.fileSystem.Commit(fs.M("Publish Diagram", m.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return m, nil
}

func (b *Binder) UnpublishDiagram(id string) error {

	d, err := b.db.GetDiagram(id)
	if err != nil {
		return xerrors.Errorf("db.GetDiagram() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	m := d.To()
	m.ApplyStructure(s.To())

	fn, err := b.fileSystem.UnpublishDiagram(m)
	if err != nil {
		return xerrors.Errorf("fs.UnpublishDiagram() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Unpublish Diagram", m.Name), fn)
	if err != nil && !errors.Is(err, fs.UpdatedFilesError) {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}
