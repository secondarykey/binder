package fs_test

import (
	"binder/fs"
	"testing"
)

func TestTableName(t *testing.T) {
	fn := fs.NoteTableFile()
	if fn != "db/notes.csv" {
		t.Errorf("NoteTableFile() is not db/notes.csv")
	}
	fn = fs.DiagramTableFile()
	if fn != "db/diagrams.csv" {
		t.Errorf("DiagramTableFile() is not db/diagrams.csv")
	}
	fn = fs.AssetTableFile()
	if fn != "db/assets.csv" {
		t.Errorf("AssetTableFile() is not db/assets.csv")
	}
	fn = fs.TemplateTableFile()
	if fn != "db/templates.csv" {
		t.Errorf("TemplateTableFile() is not db/templates.csv")
	}
}
