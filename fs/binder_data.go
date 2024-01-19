package fs

import (
	"binder/db"
	"binder/db/model"
	"fmt"
	"io"
	stdFs "io/fs"
	"time"

	uuid "github.com/google/uuid"
	"golang.org/x/xerrors"
)

func (b *Binder) ExistsData(id, noteId string) bool {
	return db.ExistDatum(id, noteId)
}

func (b *Binder) EditData(d *model.Datum, f string) (*model.Datum, error) {

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
			//d.ID = fn
		}
	}

	//まだ指定がない場合
	if d.ID == "" {
		d.ID = uuid.New().String()
	}

	if regFlag {
		//新規にデータを作成
		//テキストでない場合
		n := DataTextFile(d.ID, d.NoteId)
		//ノートファイルを作成
		_, err := b.Create(n)
		if err != nil {
			return nil, xerrors.Errorf("binder Create() error: %w", err)
		}

		err = b.Commit("create: data file")
		if err != nil {
			return nil, xerrors.Errorf("Commit() error: %w", err)
		}
		d.Created = now
	}

	if f != "" {
		//asset指定の為、そのまま出力ファイルを書き込む
	}

	d.Updated = now
	if regFlag {
		//DBに追加
		err := db.InsertDatum(d)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertDatum() error: %w", err)
		}
	} else {
		err := db.UpdateDatum(d)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateDatum() error: %w", err)
		}
	}

	err := b.Commit("update: database")
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}
	return d, nil
}

func (b *Binder) ReadDataText(id, noteId string) ([]byte, error) {
	n := DataTextFile(id, noteId)
	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, fmt.Errorf("ReadFile() error\n%+v", err)
	}
	return data, nil
}

func (b *Binder) WriteDataText(id, noteId string, data []byte) error {

	n := DataTextFile(id, noteId)
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
