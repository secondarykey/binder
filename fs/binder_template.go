package fs

import (
	"fmt"
	"io"
	stdFs "io/fs"

	"golang.org/x/xerrors"
)

const (
	TemplatePageRoot = "Pages"
	PageTemplate     = "{{ define " + TemplatePageRoot + " }}"
	ContentTemplate  = "{{ define Content }}"
	EndTemplate      = "{{ end }}"
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
	return data, nil
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
