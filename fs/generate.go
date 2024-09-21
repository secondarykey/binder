package fs

import (
	"binder/db/model"

	"golang.org/x/xerrors"
)

func (f *FileSystem) GenerateHTML(n *model.Note, data []byte) (bool, error) {

	fn := HTMLFile(n)

	fp, index, err := f.create(fn)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}

	return index, nil
}

func (f *FileSystem) GenerateDiagram(d *model.Diagram, data []byte) (bool, error) {

	fn := SVGFile(d)
	fp, index, err := f.create(fn)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return index, xerrors.Errorf("Create() error: %w", err)
	}

	return index, nil
}
