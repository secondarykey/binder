package fs

import (
	"binder/api/json"
	"bytes"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (f *FileSystem) CreateDiagramFile(d *json.Diagram) (string, error) {

	fn := DiagramFile(d.Id)
	//ノートファイルを作成
	fp, err := f.Create(fn)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	return fn, nil
}

func (f *FileSystem) DeleteDiagram(d *json.Diagram) ([]string, error) {

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

func (f *FileSystem) SetDiagramStatus(d *json.Diagram) error {

	base := DiagramFile(d.Id)

	us, ps, err := f.getStatus(base, d.Republish, d.StructureUpdated)
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	d.UpdatedStatus = us
	d.PublishStatus = ps

	return nil
}

func (f *FileSystem) PublishDiagram(data []byte, d *json.Diagram) (string, error) {

	//公開ファイルを取得
	pub := SVGFile(d)
	r := bytes.NewReader(data)

	err := f.copyReader(pub, r)
	if err != nil {
		return "", xerrors.Errorf("copyReader() error: %w", err)
	}

	return pub, nil
}

func (f *FileSystem) UnpublishDiagram(d *json.Diagram) (string, error) {

	//公開ファイルを取得
	pub := SVGFile(d)
	err := f.remove(pub)
	if err != nil {
		return "", xerrors.Errorf("fs.remove() error: %w", err)
	}

	return pub, nil
}

// RenamePublishedDiagram は公開済みのダイアグラムファイルを旧aliasから新aliasへ移動する。
// 対象: docs/images/{alias}.svg
// ファイルが存在しない場合はスキップする。変更されたファイルパスのスライスを返す。
func (f *FileSystem) RenamePublishedDiagram(oldAlias, newAlias string) ([]string, error) {
	oldSVG := svgFile(oldAlias)
	newSVG := svgFile(newAlias)
	if !f.isExist(oldSVG) {
		return nil, nil
	}

	if err := f.copyFile(newSVG, oldSVG); err != nil {
		return nil, xerrors.Errorf("copyFile(%s) error: %w", oldSVG, err)
	}
	if err := f.remove(oldSVG); err != nil {
		return nil, xerrors.Errorf("remove(%s) error: %w", oldSVG, err)
	}

	return []string{oldSVG, newSVG}, nil
}
