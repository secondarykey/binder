package fs

import (
	"strings"

	"binder/db"

	"golang.org/x/xerrors"
)

func NoteTableFile() string {
	return tableFiles(db.NoteTableName)[0]
}

func DiagramTableFile() string {
	return tableFiles(db.DiagramTableName)[0]
}

func AssetTableFile() string {
	return tableFiles(db.AssetTableName)[0]
}

func TemplateTableFile() string {
	return tableFiles(db.TemplateTableName)[0]
}

func StructureTableFile() string {
	return tableFiles(db.StructureTableName)[0]
}

func tableFile(v string) string {
	return tableFiles(v)[0]
}

func tableFiles(v ...string) []string {
	names := db.Tables()
	files := make([]string, len(v))
	for idx, n := range v {
		files[idx] = tablePath(names[n])
	}
	return files
}

func tablePath(f string) string {
	//Git
	return DBDir + "/" + f
}

func (f *FileSystem) SchemaCommit(fn string) error {

	n := tablePath(fn)
	err := f.add(n)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}

	files := allTableFiles()
	files = append(files, n)

	err = f.Commit(M("Schema Evolution", "Database"), files...)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func allTableFiles() []string {
	return tableFiles(db.NoteTableName,
		db.DiagramTableName, db.AssetTableName, db.TemplateTableName, db.StructureTableName)
}

func (f *FileSystem) AddDBFiles() error {

	files := allTableFiles()

	err := f.add(files...)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}

// AddFile は指定したファイルをgitのインデックスに追加する
func (f *FileSystem) AddFile(name string) error {
	err := f.add(name)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}

// RemoveFile はファイルをgitのインデックスから削除する（削除のステージング）
// ファイルが追跡されていない場合はエラーを無視する
func (f *FileSystem) RemoveFile(name string) error {
	return f.remove(name)
}

// StagePublishDirRemovals は公開ディレクトリ（docs）内の削除済みファイルをgitインデックスにステージする。
// マイグレーション時に docs/ を OS 上で削除した後に呼び出す。
// 追跡されていないファイルは無視する。
func (f *FileSystem) StagePublishDirRemovals() error {

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("Status() error: %w", err)
	}

	prefix := publishDir + "/"
	for path := range status {
		if strings.HasPrefix(path, prefix) {
			// エラーは無視（未追跡ファイルが含まれる場合）
			_, _ = w.Remove(path)
		}
	}
	return nil
}
