package fs

import (
	"binder/db/model"
	"fmt"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (f *FileSystem) CreateDiagramFile(d *model.Diagram) error {

	fn := DiagramFile(d.Id)
	//ノートファイルを作成
	fp, err := f.Create(fn)
	if err != nil {
		return xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	err = f.Commit(M("Create", d.Name), fn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) DeleteDiagram(id string) error {

	fn := DiagramFile(id)

	err := f.Remove(fn)
	if err != nil {
		return xerrors.Errorf("fs.Remove() error: %w", err)
	}

	//TODO 名称
	err = f.Commit(M("Remove", ""), fn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) ReadDiagram(id string) ([]byte, error) {

	fn := DiagramFile(id)

	//TODO stdFs必要？
	data, err := stdFs.ReadFile(f, fn)
	if err != nil {
		return nil, fmt.Errorf("diagramTextFile() error\n%+v", err)
	}
	return data, nil
}

func (f *FileSystem) WriteDiagram(id string, data []byte) error {

	fn := DiagramFile(id)

	fp, err := f.Create(fn)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.Write([]byte(data))
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (f *FileSystem) SetDiagramStatus(d *model.Diagram) error {

	//元ファイルを作成
	base := DiagramFile(d.Id)
	//公開ファイルを取得
	pub := SVGFile(d)

	status, err := f.getPublishStatus(base, pub)
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}

	d.Status = status
	return nil
}

func (f *FileSystem) PublishDiagram(d *model.Diagram) error {
	return nil
}

func (f *FileSystem) UnpublishDiagram(d *model.Diagram) error {
	return nil
}
