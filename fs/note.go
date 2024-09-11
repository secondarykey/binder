package fs

import (
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"os"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *FileSystem) EditNote(n *model.Note, image string) (*model.Note, bool, error) {

	if n.Id == "" {
		id, err := uuid.NewV7()
		if err != nil {
			return nil, false, xerrors.Errorf("uuid.NewV7() error: %w", err)
		}
		n.Id = id.String()
	}

	regFlag := false
	name := noteTextFile(n.Id)

	if !b.isExist(name) {
		regFlag = true
		_, err := b.Create(name)
		if err != nil {
			return nil, false, xerrors.Errorf("binder Create() error: %w", err)
		}
		err = b.Commit(M("create", "Note "+n.Name), name)
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
	}

	//画像指定がある場合画像を作成
	if image != "" {

		name := noteImage(n.Id)
		fp, err := b.Create(name)
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
		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return nil, false, xerrors.Errorf("writer Write() error: %w", err)
		}

		err = b.Commit(M("create", "Note Image "+n.Name), name)
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
	}
	return n, regFlag, nil
}

func (b *FileSystem) DeleteNote(id string) error {
	return nil
}

func (b *FileSystem) ReadNoteText(id string) ([]byte, error) {
	n := noteTextFile(id)
	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}
	return data, nil
}

func (b *FileSystem) WriteNoteText(id string, data []byte) error {

	n := noteTextFile(id)
	fp, err := b.Create(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write(data)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (b *FileSystem) GenerateHTML(id string, data []byte) (bool, error) {

	fn := noteHTML(id)

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
