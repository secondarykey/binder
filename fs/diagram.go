package fs

import (
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (b *FileSystem) CreateDiagramFile(d *model.Diagram) error {

	n := DiagramFile(d.Id)
	//ノートファイルを作成
	fp, err := b.Create(n)
	if err != nil {
		return xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	err = b.Commit(M("create", d.Name), n)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *FileSystem) DeleteDiagram(id string) error {
	//TODO 削除
	n := DiagramFile(id)
	return b.Remove(n)
}

func (b *FileSystem) ReadDiagram(id string) ([]byte, error) {

	n := DiagramFile(id)
	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, fmt.Errorf("diagramTextFile() error\n%+v", err)
	}
	return data, nil
}

func (b *FileSystem) WriteDiagram(id string, data []byte) error {

	n := DiagramFile(id)
	fp, err := b.Create(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write([]byte(data))
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (b *FileSystem) GenerateDiagram(d *model.Diagram, data []byte) (bool, error) {

	fn := SVGFile(d)
	fp, index, err := b.CreateWithFlag(fn)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write(data)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}

	return index, nil
}
