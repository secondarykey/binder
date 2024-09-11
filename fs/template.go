package fs

import (
	"bytes"
	"fmt"
	"io"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

const (
	TemplatePageRoot     = "Pages"
	layoutTemplateFrame  = `{{ define "` + TemplatePageRoot + `" }}`
	contentTemplateFrame = `{{ define "Content" }}`
	endTemplateFrame     = `{{ end }}`
)

func (b *FileSystem) CreateTemplateFiles() error {
	err := b.WriteTemplate("layout", []byte(""))
	if err != nil {
		return xerrors.Errorf("WriteTemplate(layout) error: %w", err)
	}
	err = b.WriteTemplate("index", []byte(""))
	if err != nil {
		return xerrors.Errorf("WriteTemplate(index) error: %w", err)
	}
	err = b.WriteTemplate("list", []byte(""))
	if err != nil {
		return xerrors.Errorf("WriteTemplate(list) error: %w", err)
	}
	err = b.WriteTemplate("note", []byte(""))
	if err != nil {
		return xerrors.Errorf("WriteTemplate(note) error: %w", err)
	}
	return nil
}

func (b *FileSystem) ReadTemplate(id string) ([]byte, error) {

	n := TemplateFileName(id)
	if n == "" {
		return nil, fmt.Errorf("Template id[%s] error", id)
	}

	data, err := stdFs.ReadFile(b, n)
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

func (b *FileSystem) AddTemplateFrame(id string, data []byte) []byte {

	var buf bytes.Buffer
	buf.Grow(len(data) + 50)

	if id == "layout" {
		buf.Write([]byte(layoutTemplateFrame))
	} else {
		buf.Write([]byte(contentTemplateFrame))
	}

	buf.Write(data)
	buf.Write([]byte(endTemplateFrame))

	//Len() とって削除しておかないとoxooが入る？
	return buf.Bytes()
}

func (sys *FileSystem) DeleteListHTMLs() error {

	htmls, err := stdFs.Glob(sys, "docs/list*html")
	if err != nil {
		return xerrors.Errorf("Glob() error: %w", err)
	}

	for _, html := range htmls {
		err := sys.fs.Remove(html)
		if err != nil {
			return fmt.Errorf("filesystem.Remove() error\n%+v", err)
		}
	}
	return nil
}

// テンプレート用のフレームを作成して処理
func (b *FileSystem) WriteTemplate(t string, data []byte) error {

	n := TemplateFileName(t)
	if n == "" {
		return fmt.Errorf("Template id[%s] error", t)
	}

	fp, err := b.Create(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	//枠を作成
	txt := b.AddTemplateFrame(t, data)
	_, err = fp.(io.Writer).Write(txt)
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}
