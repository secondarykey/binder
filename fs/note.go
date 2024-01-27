package fs

import (
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"os"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *FileSystem) EditNote(n *model.Note, image string) (*model.Note, bool, error) {

	regFlag := false
	now := time.Now()

	if n.ID == "" {
		n.ID = uuid.New().String()
		regFlag = true
	}

	//ノートファイルを作成
	if regFlag {
		_, err := b.Create(noteTextFile(n.ID))
		if err != nil {
			return nil, false, xerrors.Errorf("binder Create() error: %w", err)
		}
		err = b.Commit("create: note file")
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
		n.Created = now
	}

	//画像指定がある場合画像を作成
	if image != "" {

		fp, err := b.Create(noteImage(n.ID))
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

		err = b.Commit("create: note image")
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
	}
	n.Updated = now

	return n, regFlag, nil
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

func (b *FileSystem) GenerateHTML(id string, data []byte) error {

	fn := noteHTML(id)
	fp, err := b.Create(fn)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write(data)
	if err != nil {
		return xerrors.Errorf("Create() error: %w", err)
	}

	return nil
}
