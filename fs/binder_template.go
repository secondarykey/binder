package fs

import (
	"fmt"
	"io"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

const (
	//                  12345
	TemplatePageRoot = "Pages"
	//                   12345678901                        2345  123456789
	PageTemplateFrame = `{{ define "` + TemplatePageRoot + `" }}%s{{ end }}`
	//                      1234567890123456789012  123456789
	ContentTemplateFrame = `{{ define "Content" }}%s{{ end }}`
)

func (b *Binder) ReadTemplate(id string) ([]byte, error) {

	n := TemplateFileName(id)
	if n == "" {
		return nil, fmt.Errorf("Template id[%s] error", id)
	}

	data, err := stdFs.ReadFile(b, n)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}

	firstIdx := 20
	leng := len(data)
	if id != "layout" {
		firstIdx = 22
	}
	return data[firstIdx : leng-9], nil
}

func (b *Binder) AddTemplateFrame(id string, data string) string {
	txt := ""
	if id == "layout" {
		txt = fmt.Sprintf(PageTemplateFrame, data)
	} else {
		txt = fmt.Sprintf(ContentTemplateFrame, data)
	}
	return txt
}

func (b *Binder) WriteTemplate(id string, data []byte) error {

	n := TemplateFileName(id)
	if n == "" {
		return fmt.Errorf("Template id[%s] error", id)
	}

	fp, err := b.Open(n)
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
