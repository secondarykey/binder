package binder

import (
	"fmt"
	"strings"
	"time"

	"binder/api/json"
	"binder/fs"
)

type wrapper struct {
	owner *Binder
	note  *json.Note
	Local bool
	depth int // embed の再帰深度（循環参照防止）
}

func newWrapper(o *Binder, local bool, note *json.Note) (*wrapper, error) {
	var w wrapper
	w.owner = o
	w.Local = local
	w.note = note
	return &w, nil
}

func (w *wrapper) localAddr() string {
	return fmt.Sprintf("http://%s", w.owner.ServerAddress())
}

// relativePrefix は公開HTMLでのリソース参照用の相対パスプレフィックスを返す。
// index.html は docs/ 直下にあるため "./"、サブページは docs/pages/ 配下にあるため "../"。
func (w *wrapper) relativePrefix() string {
	if w.note != nil && w.note.Id != "index" {
		return "../"
	}
	return "./"
}

// 出力形式に変更
func (w *wrapper) convertNote(n *json.Note) *tempNote {

	var t tempNote

	t.Id = n.Id
	t.Name = n.Name
	t.Detail = n.Detail
	t.Publish = formatTime(n.Publish)
	t.Created = formatTime(n.Created)
	t.Updated = formatTime(w.getUpdatedNoteFile(n))

	p := fs.HTMLFile(n)
	t.Link = w.convertURL(p)

	// メタ画像URL: ローカルプレビュー時は絶対URLでファイルサーバー経由でアクセス
	m := fs.PublicMetaFile(n)
	if w.Local {
		addr := w.owner.ServerAddress()
		if addr != "" {
			t.Image = fmt.Sprintf("http://%s/%s", addr, w.publishRelPath(m))
		}
	} else {
		t.Image = w.convertURL(m)
	}

	//TODO PREV NEXTは？

	return &t
}

func (w *wrapper) getUpdatedNoteFile(n *json.Note) time.Time {

	info, err := w.owner.fileSystem.Stat(fs.HTMLFile(n))
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

func (w *wrapper) getCurrentNote() *tempNote {
	if w.note == nil {
		return nil
	}
	return w.convertNote(w.note)
}

// publishRelPath は公開ディレクトリ(docs/)を除去した相対パスを返す。
func (w *wrapper) publishRelPath(p string) string {
	np := strings.ReplaceAll(p, "\\", "/")
	cp := w.owner.fileSystem.GetPublic() + "/"
	return strings.Replace(np, cp, "", 1)
}

// 取得してきたパスからURL変換
// 公開ディレクトリ(docs/)を除去し、ノートの階層に応じた相対プレフィックスを付与する。
func (w *wrapper) convertURL(p string) string {
	return w.relativePrefix() + w.publishRelPath(p)
}
