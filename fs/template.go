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

// テンプレート用のフレームを作成して処理
func AddTemplateFrame(t model.TemplateType, data []byte) []byte {

	typ := model.TemplateType(t)
	if !typ.IsHTML() {
		return data
	}

	var buf bytes.Buffer
	buf.Grow(len(data) + 50)

	if typ.IsContent() {
		buf.Write([]byte(contentTemplateFrame))
	} else {
		buf.Write([]byte(layoutTemplateFrame))
	}

	buf.Write(data)
	buf.Write([]byte(endTemplateFrame))

	//Len() とって削除しておかないとoxooが入る？
	return buf.Bytes()
}

func (f *FileSystem) CreateTemplateFile(t *model.Template) (string, error) {

	n := TemplateFile(t.Id)
	//ノートファイルを作成
	fp, err := f.Create(n)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	//TODO レイアウト時は追加を設定
	typ := model.TemplateType(t.Typ)
	if typ.IsHTML() {
	}

	return n, nil
}

func (f *FileSystem) ReadTemplate(t *model.Template) ([]byte, error) {

	fn := TemplateFile(t.Id)

	data, err := stdFs.ReadFile(f, fn)
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadFile() error: %w", err)
	}

	//レイアウト用のフレームを削除して返す
	typ := model.TemplateType(t.Typ)
	if typ.IsHTML() {
		firstIdx := len(layoutTemplateFrame)
		if typ.IsContent() {
			firstIdx = len(contentTemplateFrame)
		}
		leng := len(data) - len(endTemplateFrame)
		return data[firstIdx:leng], nil
	}

	return data, nil
}

func (f *FileSystem) WriteTemplate(t *model.Template, data []byte) (string, error) {

	fn := TemplateFile(t.Id)
	fp, err := f.Create(fn)
	if err != nil {
		return "", fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	//枠を作成
	txt := AddTemplateFrame(model.TemplateType(t.Typ), data)

	_, err = fp.Write(txt)
	if err != nil {
		return "", fmt.Errorf("Write() error\n%+v", err)
	}
	return fn, nil
}

func (f *FileSystem) SetTemplateStatus(t *model.Template) error {

	//元ファイルを作成
	base := TemplateFile(t.Id)

	us, _, err := f.getStatus(base, "")
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	fmt.Println(t.Id, us)
	t.UpdatedStatus = us

	return nil
}
