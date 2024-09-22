package fs

import (
	"binder/db/model"
	"bytes"
	"fmt"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

const (
	TemplatePageRoot     = "Pages"
	layoutTemplateFrame  = `{{ define "` + TemplatePageRoot + `" }}`
	contentTemplateFrame = `{{ define "Content" }}`
	endTemplateFrame     = `{{ end }}`
)

func (f *FileSystem) CreateTemplateFile(t *model.Template) error {

	n := TemplateFile(t.Id)
	//ノートファイルを作成
	fp, err := f.Create(n)
	if err != nil {
		return xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	err = f.Commit(M("create", t.Name), n)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) ReadTemplate(id string) ([]byte, error) {

	fn := TemplateFile(id)
	data, err := stdFs.ReadFile(f, fn)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}

	//レイアウト用のフレームを削除して返す
	firstIdx := len(layoutTemplateFrame)
	if id != "layout" {
		firstIdx = len(contentTemplateFrame)
	}
	leng := len(data) - len(endTemplateFrame)

	return data[firstIdx:leng], nil
}

func (f *FileSystem) WriteTemplate(t string, data []byte) error {

	fn := TemplateFile(t)
	fp, err := f.Create(fn)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	//枠を作成
	txt := AddTemplateFrame(t, data)

	_, err = fp.Write(txt)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

// テンプレート用のフレームを作成して処理
func AddTemplateFrame(typ string, data []byte) []byte {

	var buf bytes.Buffer
	buf.Grow(len(data) + 50)

	if typ == "layout" {
		buf.Write([]byte(layoutTemplateFrame))
	} else {
		buf.Write([]byte(contentTemplateFrame))
	}

	buf.Write(data)
	buf.Write([]byte(endTemplateFrame))

	//Len() とって削除しておかないとoxooが入る？
	return buf.Bytes()
}
