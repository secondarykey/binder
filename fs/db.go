package fs

import (
	"binder/db"

	"golang.org/x/xerrors"
)

func ConfigTableFile() string {
	return tableFiles(db.ConfigTableName)[0]
}

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

func (f *FileSystem) AddDBFiles(ver string) error {

	files := tableFiles(db.ConfigTableName, db.NoteTableName,
		db.DiagramTableName, db.AssetTableName, db.TemplateTableName, ver)

	err := f.add(files...)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}

func (f *FileSystem) commitTableFiles(m string, tables ...string) error {

	files := tableFiles(tables...)

	err := f.Commit(m, files...)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (f *FileSystem) CommitConfigTable(m string) error {
	err := f.commitTableFiles(m, db.ConfigTableName)
	if err != nil {
		return xerrors.Errorf("commitTableFiles() error: %w", err)
	}
	return nil
}

func (f *FileSystem) CommitNoteTable(m string) error {
	err := f.commitTableFiles(m, db.NoteTableName)
	if err != nil {
		return xerrors.Errorf("commitTableFiles() error: %w", err)
	}
	return nil
}

func (f *FileSystem) CommitDiagramTable(m string) error {
	err := f.commitTableFiles(m, db.DiagramTableName)
	if err != nil {
		return xerrors.Errorf("commitTableFiles() error: %w", err)
	}
	return nil
}

func (f *FileSystem) CommitAssetTable(m string) error {
	err := f.commitTableFiles(m, db.AssetTableName)
	if err != nil {
		return xerrors.Errorf("commitTableFiles() error: %w", err)
	}
	return nil
}

func (f *FileSystem) CommitTemplateTable(m string) error {
	err := f.commitTableFiles(m, db.TemplateTableName)
	if err != nil {
		return xerrors.Errorf("commitTableFiles() error: %w", err)
	}
	return nil
}
