package fs

import (
	"binder/api/json"
	"bytes"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateLayerFile(l *json.Layer) (string, error) {

	fn := LayerFile(l.Id)
	fp, err := f.Create(fn)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	return fn, nil
}

func (f *FileSystem) DeleteLayer(l *json.Layer) ([]string, error) {

	var files []string

	fn := PublicLayerFile(l)
	if fn != "" && f.isExist(fn) {
		files = append(files, fn)
	}

	fn = LayerFile(l.Id)
	if f.isExist(fn) {
		files = append(files, fn)
	} else {
		return nil, xerrors.Errorf("layer file not exist: %s", fn)
	}

	err := f.remove(files...)
	if err != nil {
		return nil, xerrors.Errorf("fs.remove() error: %w", err)
	}

	return files, nil
}

func (f *FileSystem) ReadLayer(w io.Writer, id string) error {

	fn := LayerFile(id)

	err := f.readFile(w, fn)
	if err != nil {
		return fmt.Errorf("layerTextFile() error\n%+v", err)
	}
	return nil
}

func (f *FileSystem) WriteLayer(id string, data []byte) error {

	fn := LayerFile(id)

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

func (f *FileSystem) SetLayerStatus(l *json.Layer) error {

	base := LayerFile(l.Id)

	us, ps, err := f.getStatus(base, l.Republish, l.StructureUpdated)
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	l.UpdatedStatus = us
	l.PublishStatus = ps

	return nil
}

func (f *FileSystem) PublishLayer(data []byte, l *json.Layer) (string, error) {

	pub := PublicLayerFile(l)
	r := bytes.NewReader(data)

	err := f.copyReader(pub, r)
	if err != nil {
		return "", xerrors.Errorf("copyReader() error: %w", err)
	}

	return pub, nil
}

func (f *FileSystem) UnpublishLayer(l *json.Layer) (string, error) {

	pub := PublicLayerFile(l)
	err := f.remove(pub)
	if err != nil {
		return "", xerrors.Errorf("fs.remove() error: %w", err)
	}

	return pub, nil
}

// RenamePublishedLayer は公開済みレイヤーSVGを旧aliasから新aliasへ移動する。
// 対象: docs/layers/{alias}.svg
func (f *FileSystem) RenamePublishedLayer(oldAlias, newAlias string) ([]string, error) {
	oldFile := publicLayerFile(oldAlias)
	newFile := publicLayerFile(newAlias)
	if !f.isExist(oldFile) {
		return nil, nil
	}

	if err := f.copyFile(newFile, oldFile); err != nil {
		return nil, xerrors.Errorf("copyFile(%s) error: %w", oldFile, err)
	}
	if err := f.remove(oldFile); err != nil {
		return nil, xerrors.Errorf("remove(%s) error: %w", oldFile, err)
	}

	return []string{oldFile, newFile}, nil
}
