package fs

import (
	"binder/api/json"
	"bytes"
	"fmt"
	"io"
	"os"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateNoteFile(n *json.Note) (string, error) {

	fn := NoteFile(n.Id)
	fp, err := f.Create(fn)
	if err != nil {
		return "", xerrors.Errorf("Note Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write([]byte("# " + n.Name))
	if err != nil {
		return "", xerrors.Errorf("Note Write() error: %w", err)
	}

	return fn, nil
}

func (f *FileSystem) EditMetadata(n *json.Note, fn string) (string, error) {

	mf := MetaFile(n)
	fp, err := f.Create(mf)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	//ローカルファイルを取得
	data, err := os.ReadFile(fn)
	if err != nil {
		return "", xerrors.Errorf("image file ReadFile() error: %w", err)
	}

	//それを書き込む
	_, err = fp.Write(data)
	if err != nil {
		return "", xerrors.Errorf("writer Write() error: %w", err)
	}

	return mf, nil
}

func (f *FileSystem) DeleteNote(n *json.Note) ([]string, error) {

	var files []string

	fn := HTMLFile(n)
	if f.isExist(fn) {
		files = append(files, fn)
	}

	fn = NoteFile(n.Id)
	if f.isExist(fn) {
		files = append(files, fn)
	} else {
		return nil, xerrors.Errorf("note file not exist : %s", fn)
	}

	err := f.remove(files...)
	if err != nil {
		return nil, xerrors.Errorf("fs.remove(%s) error: %w", fn, err)
	}
	return files, nil
}

func (f *FileSystem) ReadNoteText(w io.Writer, id string) error {

	n := NoteFile(id)

	err := f.readFile(w, n)
	if err != nil {
		return xerrors.Errorf("fs.ReadFile() error: %w", err)
	}
	return nil
}

func (f *FileSystem) WriteNoteText(id string, data []byte) error {

	n := NoteFile(id)
	fp, err := f.Create(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.Write(data)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (f *FileSystem) SetNoteStatus(n *json.Note) error {

	//元ファイルを作成
	base := NoteFile(n.Id)
	//公開ファイルを取得
	pub := HTMLFile(n)

	us, ps, err := f.getStatus(base, pub)
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	n.UpdatedStatus = us
	n.PublishStatus = ps

	return nil
}

func (f *FileSystem) PublishNote(data []byte, n *json.Note) (string, error) {
	//公開ファイルを取得
	pub := HTMLFile(n)
	r := bytes.NewReader(data)

	err := f.copyReader(pub, r)
	if err != nil {
		return "", xerrors.Errorf("copyReader() error: %w", err)
	}

	return pub, nil
}

func (f *FileSystem) UnpublishNote(n *json.Note) (string, error) {

	//公開ファイルを取得
	pub := HTMLFile(n)
	err := f.remove(pub)
	if err != nil {
		return "", xerrors.Errorf("fs.remove() error: %w", err)
	}

	return pub, nil
}
