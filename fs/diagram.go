package fs

import (
	"binder/db/model"
	"bytes"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (f *FileSystem) CreateDiagramFile(d *model.Diagram) (string, error) {

	fn := DiagramFile(d.Id)
	//ノートファイルを作成
	fp, err := f.Create(fn)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	return fn, nil
}

func (f *FileSystem) DeleteDiagram(d *model.Diagram) ([]string, error) {

	var files []string

	fn := SVGFile(d)
	if f.isExist(fn) {
		files = append(files, fn)
	}

	fn = DiagramFile(d.Id)
	if f.isExist(fn) {
		files = append(files, fn)
	} else {
		return nil, xerrors.Errorf("diagram file not exist: %s", fn)
	}

	err := f.remove(files...)
	if err != nil {
		return nil, xerrors.Errorf("fs.remove() error: %w", err)
	}

	return files, nil
}

func (f *FileSystem) ReadDiagram(w io.Writer, id string) error {

	fn := DiagramFile(id)

	err := f.readFile(w, fn)
	if err != nil {
		return fmt.Errorf("diagramTextFile() error\n%+v", err)
	}
	return nil
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

	us, ps, err := f.getStatus(base, pub)
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	d.UpdatedStatus = us
	d.PublishStatus = ps

	return nil
}

func (f *FileSystem) PublishDiagram(data []byte, d *model.Diagram) (string, error) {

	//公開ファイルを取得
	pub := SVGFile(d)
	r := bytes.NewReader(data)

	err := f.copyReader(pub, r)
	if err != nil {
		return "", xerrors.Errorf("copyReader() error: %w", err)
	}

	return pub, nil
}

func (f *FileSystem) UnpublishDiagram(d *model.Diagram) (string, error) {

	//公開ファイルを取得
	pub := SVGFile(d)
	err := f.remove(pub)
	if err != nil {
		return "", xerrors.Errorf("fs.remove() error: %w", err)
	}

	return pub, nil
}
