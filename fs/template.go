package fs

import (
	"bytes"
	"fmt"
	"io"
	"time"

	"binder/api/json"

	"golang.org/x/xerrors"
)

const (
	TemplatePageRoot     = "Pages"
	layoutTemplateFrame  = `{{ define "` + TemplatePageRoot + `" }}`
	contentTemplateFrame = `{{ define "Content" }}`
	endTemplateFrame     = `{{ end }}`
)

// AddTemplateFrame はテンプレートの内容を Go テンプレートの {{ define "..." }}...{{ end }} で包む。
// HTML レンダリング時に内部で呼ばれるため、ファイルにはフレームを書かなくてよい。
func AddTemplateFrame(t json.TemplateType, data []byte) []byte {

	typ := json.TemplateType(t)
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

	return buf.Bytes()
}

// StripTemplateFrame は保存済みテンプレートファイルから {{ define ... }}/{{ end }} フレームを取り除く。
// 以前の形式（ファイルにフレームを含めていた）との後方互換のために使用する。
func StripTemplateFrame(t json.TemplateType, data []byte) []byte {

	typ := json.TemplateType(t)
	if !typ.IsHTML() {
		return data
	}

	var frame string
	if typ.IsContent() {
		frame = contentTemplateFrame
	} else {
		frame = layoutTemplateFrame
	}

	if bytes.HasPrefix(data, []byte(frame)) && bytes.HasSuffix(data, []byte(endTemplateFrame)) {
		data = data[len(frame):]
		data = data[:len(data)-len(endTemplateFrame)]
		return bytes.TrimSpace(data)
	}

	return data
}

func (f *FileSystem) CreateTemplateFile(t *json.Template) (string, error) {

	n := TemplateFile(t.Id)
	//ノートファイルを作成
	fp, err := f.Create(n)
	if err != nil {
		return "", xerrors.Errorf("binder Create() error: %w", err)
	}
	defer fp.Close()

	//TODO レイアウト時は追加を設定
	typ := json.TemplateType(t.Typ)
	if typ.IsHTML() {
	}

	return n, nil
}

// ReadTemplate はテンプレートファイルの生の内容（フレームなし）をライターに書き出す。
// ファイルには {{ define "..." }} フレームを含めないため、そのまま返す。
func (f *FileSystem) ReadTemplate(w io.Writer, t *json.Template) error {

	fn := TemplateFile(t.Id)

	err := f.readFile(w, fn)
	if err != nil {
		return xerrors.Errorf("fs.readFile() error: %w", err)
	}

	return nil
}

func (f *FileSystem) WriteTemplate(t *json.Template, data []byte) (string, error) {

	fn := TemplateFile(t.Id)

	fp, err := f.Create(fn)
	if err != nil {
		return "", fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	//枠を作成
	//txt := AddTemplateFrame(model.TemplateType(t.Typ), data)

	_, err = fp.Write(data)
	if err != nil {
		return "", fmt.Errorf("Write() error\n%+v", err)
	}
	return fn, nil
}

func (f *FileSystem) DeleteTemplateFile(t *json.Template) ([]string, error) {

	fn := TemplateFile(t.Id)
	if !f.isExist(fn) {
		return nil, xerrors.Errorf("template file not exist : %s", fn)
	}

	err := f.remove(fn)
	if err != nil {
		return nil, xerrors.Errorf("fs.remove(%s) error: %w", fn, err)
	}
	return []string{fn}, nil
}

func (f *FileSystem) SetTemplateStatus(t *json.Template) error {

	//元ファイルを作成
	base := TemplateFile(t.Id)

	us, _, err := f.getStatus(base, time.Time{}, time.Time{})
	if err != nil {
		return xerrors.Errorf("getPublishStatus() error: %w", err)
	}
	t.UpdatedStatus = us

	return nil
}
