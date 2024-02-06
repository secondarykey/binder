package fs

import (
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"os"

	"golang.org/x/xerrors"
)

// ID 指定は上位でやっておく
func (b *FileSystem) EditData(d *model.Datum, f string, reg bool) (*model.Datum, error) {

	//ファイル指定がある場合
	if f != "" {
		dataF := dataPath(d.ID, d.NoteId)
		fp, err := b.Create(dataF)
		if err != nil {
			return nil, xerrors.Errorf("CreateFile() error: %w", err)
		}
		defer fp.Close()
		data, err := os.ReadFile(f)
		if err != nil {
			return nil, xerrors.Errorf("ReadFile() error: %w", err)
		}
		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return nil, xerrors.Errorf("Write() error: %w", err)
		}

		//TODO データのコミットを行う

	}

	//新規作成時にファイル登録だけやっておく
	if d.PluginId != "mermaid" || !reg {
		return d, nil
	}

	//テキストでない場合
	n := dataTextFile(d.ID, d.NoteId)
	//ノートファイルを作成
	fp, err := b.Create(n)
	if err != nil {
		return nil, xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	err = b.Commit(M("create", d.Name), n)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return d, nil
}

func (b *FileSystem) ReadDataText(id, noteId string) ([]byte, error) {

	n := dataTextFile(id, noteId)
	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, fmt.Errorf("ReadFile() error\n%+v", err)
	}
	return data, nil
}

func (b *FileSystem) WriteDataText(id, noteId string, data []byte) error {

	n := dataTextFile(id, noteId)
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

func (b *FileSystem) GenerateData(id string, noteId string, data []byte) (bool, error) {

	fn := dataPath(id, noteId)
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
