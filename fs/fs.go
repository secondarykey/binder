package fs

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
)

//go:embed _assets/binder
var embFs embed.FS
var assetsFs fs.FS

func init() {
	var err error
	assetsFs, err = fs.Sub(embFs, "_assets/binder")
	if err != nil {
		panic(err)
	}
}

// 現行のBinderと同じ
// Binderはルートに移行しておく
type FileSystem struct {
}

// Binder File System
// -> 空のディレクトリは作成時に無理なので気を付ける
//   - docs/
//     index.html
//     list_{%num}.html
//   - notes/
//     {note_id}.html
//     {note_id} -> 指定した画像データ
//   - assets/
//     {data_id} (none note_id)
//   - {note_id}/
//     {data_id}
var publishDir = "docs"

func indexHTML() string {
	return filepath.Join(publishDir, "index.html")
}

func listHTML(idx int) string {
	return filepath.Join(publishDir, fmt.Sprintf("list_%d.html", idx))
}

func noteHTML(id string) string {
	return filepath.Join(publishDir, "notes", fmt.Sprintf("%s.html", id))
}

func noteImage(id string) string {
	return filepath.Join(publishDir, "assets", fmt.Sprintf("%s", id), "index")
}

func assetsPath(id string, noteId string) string {
	if noteId == "" {
		return filepath.Join(publishDir, "assets", id)
	}
	return filepath.Join(publishDir, "assets", noteId, "%s")
}

//   - templates/
//     layout.tmpl (指定できるようにすべきかなぁ、、、)
//     index.tmpl
//     list.tmpl
//     note.tmpl
const templateDir = "templates"

func TemplateFileName(id string) string {
	switch id {
	case "layoout":
		return layoutTemplate()
	case "index":
		return indexTemplate()
	case "list":
		return listTemplate()
	case "note":
		return noteTemplate()
	}
	return ""
}

func layoutTemplate() string {
	return filepath.Join(templateDir, "layout.tmpl")
}

func indexTemplate() string {
	return filepath.Join(templateDir, "index.tmpl")
}

func listTemplate() string {
	return filepath.Join(templateDir, "list.tmpl")
}

func noteTemplate() string {
	return filepath.Join(templateDir, "note.tmpl")
}

//   - notes/
//     {note_id}.md
const noteDir = "notes"

func NoteTextFile(id string) string {
	return filepath.Join(noteDir, fmt.Sprintf("%s.md", id))
}

//   - data/
//     {data_id}.md
//   - {note_id}/
//     {data_id}.md //assets は直接docsに入れる
const dataDir = "data"

func DataTextFile(id string, noteId string) string {
	if noteId == "" {
		return filepath.Join(dataDir, fmt.Sprintf("%s.md", id))
	}
	return filepath.Join(dataDir, noteId, fmt.Sprintf("%s.md", id))
}

//  ディレクトリのみを取得
//   - db/
//     config.csv
//     notes.csv
//     data.csv

func Check(dir string, create bool) error {

	//ファイルシステムの確認

	//データベースを確認

	//notesの状態

	//dataの状態

	//状態

	//git status確認
	return nil
}
