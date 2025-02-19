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
	return tableFiles(db.ConfigTableName, db.NoteTableName,
		db.DiagramTableName, db.AssetTableName, db.TemplateTableName)
}

func (f *FileSystem) AddDBFiles() error {

	files := allTableFiles()
	files = append(files, tablePath(db.SchemaFile))

	err := f.add(files...)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}
