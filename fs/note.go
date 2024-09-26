package fs

import (
	"binder/db/model"
	"bytes"
	"fmt"
	stdFs "io/fs"
	"os"

	"golang.org/x/xerrors"
)

func (f *FileSystem) CreateNoteFile(n *model.Note) error {

	fn := NoteFile(n.Id)
	fp, err := f.Create(fn)
	if err != nil {
		return xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	err = f.Commit(M("create", "Note "+n.Name), fn)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) EditMetadata(n *model.Note, fn string) error {

	mf := MetaFile(n)
	fp, err := f.Create(mf)
	if err != nil {
		return xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	//ローカルファイルを取得
	data, err := os.ReadFile(fn)
	if err != nil {
		return xerrors.Errorf("image file ReadFile() error: %w", err)
	}

	//それを書き込む
	_, err = fp.Write(data)
	if err != nil {
		return xerrors.Errorf("writer Write() error: %w", err)
	}

	err = f.Commit(M("create", "Note Image "+n.Name), mf)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (f *FileSystem) DeleteNote(id string) error {
	fn := NoteFile(id)
	err := f.Remove(fn)
	if err != nil {
		return xerrors.Errorf("fs.Remove() error: %w", err)
	}
	return nil
}

func (f *FileSystem) ReadNoteText(id string) ([]byte, error) {

	n := NoteFile(id)
	//TODO stdFs必要？
	data, err := stdFs.ReadFile(f, n)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}
	return data, nil
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

func (f *FileSystem) SetNoteStatus(n *model.Note) error {

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

func (f *FileSystem) PublishNote(data []byte, n *model.Note) error {
	//公開ファイルを取得
	pub := HTMLFile(n)
	r := bytes.NewReader(data)

	err := f.copyReader(pub, r)
	if err != nil {
		return xerrors.Errorf("copyReader() error: %w", err)
	}

	err = f.Commit(M("Publish", n.Name), pub)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (f *FileSystem) UnpublishNote(n *model.Note) error {
	//公開ファイルを取得
	pub := HTMLFile(n)
	err := f.Remove(pub)
	if err != nil {
		return xerrors.Errorf("fs.Remove() error: %w", err)
	}

	err = f.Commit(M("Unpublish", n.Name), pub)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}
