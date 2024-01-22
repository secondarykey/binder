package fs

import (
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"os"
	"path/filepath"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *FileSystem) EditData(d *model.Datum, f string) (*model.Datum, bool, error) {

	regFlag := false
	now := time.Now()

	if d.ID == "" {
		regFlag = true
	}

	//プラグイン設定がなく、ファイル指定がある場合
	// Assetsのファイルなし更新を考慮
	if f != "" {
		if regFlag {
			//ファイル名からIDを作成
			fn := filepath.Base(f)
			d.ID = fn
			d.Name = fn
		}

		dataF := dataPath(d.ID, d.NoteId)
		fp, err := b.Create(dataF)
		if err != nil {
			return nil, false, xerrors.Errorf("CreateFile() error: %w", err)
		}
		defer fp.Close()

		data, err := os.ReadFile(f)
		if err != nil {
			return nil, false, xerrors.Errorf("ReadFile() error: %w", err)
		}
		_, err = fp.(io.Writer).Write(data)
		if err != nil {
			return nil, false, xerrors.Errorf("Write() error: %w", err)
		}
	}

	//まだ指定がない場合
	if d.ID == "" {
		d.ID = uuid.New().String()
	}

	if regFlag && d.PluginId == "mermaid" {
		//新規にデータを作成
		//テキストでない場合
		n := dataTextFile(d.ID, d.NoteId)
		//ノートファイルを作成
		_, err := b.Create(n)
		if err != nil {
			return nil, false, xerrors.Errorf("binder Create() error: %w", err)
		}

		err = b.Commit("create: data file")
		if err != nil {
			return nil, false, xerrors.Errorf("Commit() error: %w", err)
		}
		d.Created = now
	}

	d.Updated = now
	return d, regFlag, nil
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
	fp, err := b.Open(n)
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
