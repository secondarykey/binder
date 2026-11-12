package binder_test

import (
	"binder/db"
	"binder/fs"

	"slices"
	"testing"
)

// fs が持つ DB の CSV ファイル名が、db のテーブルのファイル名と揃っていること。
// fs は db を import しないので、ファイル名を自分で持っている（fs/db.go）。
// テーブルを足したのに fs 側へ足し忘れると、その CSV が記録に入らない。
func TestTableFilesMatchDB(t *testing.T) {
	tables := db.Tables()

	cases := map[string]string{
		db.NoteTableName:      fs.NoteTableFile(),
		db.DiagramTableName:   fs.DiagramTableFile(),
		db.AssetTableName:     fs.AssetTableFile(),
		db.LayerTableName:     fs.LayerTableFile(),
		db.TemplateTableName:  fs.TemplateTableFile(),
		db.StructureTableName: fs.StructureTableFile(),
	}
	for name, got := range cases {
		file, ok := tables[name]
		if !ok {
			t.Errorf("db.Tables() に %s が無い", name)
			continue
		}
		if want := fs.DBDir + "/" + file; got != want {
			t.Errorf("%s: fs のパス = %q, want %q", name, got, want)
		}
	}

	// db のテーブルは、すべて fs の一覧に入っている（逆も）
	all := fs.AllTableFiles()
	if len(all) != len(tables) {
		t.Errorf("fs.AllTableFiles() = %d 件, db.Tables() = %d 件", len(all), len(tables))
	}
	for name, file := range tables {
		if !slices.Contains(all, fs.DBDir+"/"+file) {
			t.Errorf("fs.AllTableFiles() に %s（%s）が無い", name, file)
		}
	}
}
