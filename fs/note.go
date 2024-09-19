package fs

import (
	"binder/db/model"
	"fmt"
	stdFs "io/fs"
	"os"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (f *FileSystem) EditNote(n *model.Note, image string) (*model.Note, bool, error) {

	if n.Id == "" {
		id, err := uuid.NewV7()
		if err != nil {
			return nil, false, xerrors.Errorf("uuid.NewV7() error: %w", err)
		}
		n.Id = id.String()
	}

	regFlag := false
	fn := NoteFile(n.Id)

	//TODO これ要らない
	if !f.isExist(fn) {
		regFlag = true
		_, err := f.Create(fn)
		if err != nil {
			return nil, false, xerrors.Errorf("binder Create() error: %w", err)
		}

		err = f.Commit(M("create", "Note "+n.Name), fn)
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
	}

	//画像指定がある場合画像を作成
	if image != "" {

		mf := MetaFile(n)
		fp, err := f.Create(mf)
		if err != nil {
			return nil, false, xerrors.Errorf("binder Create() error: %w", err)
		}
		defer fp.Close()

		//ローカルファイルを取得
		data, err := os.ReadFile(image)
		if err != nil {
			return nil, false, xerrors.Errorf("image file ReadFile() error: %w", err)
		}

		//それを書き込む
		_, err = fp.Write(data)
		if err != nil {
			return nil, false, xerrors.Errorf("writer Write() error: %w", err)
		}

		err = f.Commit(M("create", "Note Image "+n.Name), mf)
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
	}
	return n, regFlag, nil
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
