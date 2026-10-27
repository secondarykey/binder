package convert

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"binder/fs"
)

// writeRepairFixture は RepairSchema 用の db ディレクトリと diagram_style.tmpl を作る。
// tables のキーはファイル名、値は CSV の内容。
func writeRepairFixture(t *testing.T, tables map[string]string) (dir, dbDir string) {
	t.Helper()
	dir = t.TempDir()
	dbDir = filepath.Join(dir, fs.DBDir)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		t.Fatalf("MkdirAll(db) error: %v", err)
	}
	for name, body := range tables {
		if err := os.WriteFile(filepath.Join(dbDir, name), []byte(body), 0644); err != nil {
			t.Fatalf("WriteFile(%s) error: %v", name, err)
		}
	}
	tmpl := filepath.Join(dir, fs.TemplateDir, DiagramStyleTemplate+".tmpl")
	if err := os.MkdirAll(filepath.Dir(tmpl), 0755); err != nil {
		t.Fatalf("MkdirAll(templates) error: %v", err)
	}
	if err := os.WriteFile(tmpl, []byte(diagramStyleContent), 0644); err != nil {
		t.Fatalf("WriteFile(tmpl) error: %v", err)
	}
	return dir, dbDir
}

// repairedTables は全カラムが揃った（修復済みの）テーブル。
func repairedTables() map[string]string {
	return map[string]string{
		"structures.csv": "id,type,name,republish_date,private\nn1,note,Note,,false\n",
		"assets.csv":     "id,binary,mime\n",
		"diagrams.csv":   "id,style_template\n",
		"templates.csv":  "id,type\ndiagram_style,diagram\n",
	}
}

// TestRepairSchemaNoTempFileWhenRepaired は修復済みのバインダーで
// RepairSchema が一時ファイルを作らないことを検証する。
//
// 以前は列が揃っていても structures097.csv / diagrams097.csv を毎回作って消しており、
// 同じバインダーのロードが並行すると Windows で「Access is denied」になった。
// 一時ファイルと同名のディレクトリを置いておき、作ろうとすれば失敗する状態で確かめる。
func TestRepairSchemaNoTempFileWhenRepaired(t *testing.T) {
	dir, dbDir := writeRepairFixture(t, repairedTables())
	for _, name := range []string{"structures097.csv", "diagrams097.csv", "templates097.csv", "assets092.csv"} {
		if err := os.Mkdir(filepath.Join(dbDir, name), 0755); err != nil {
			t.Fatalf("Mkdir(%s) error: %v", name, err)
		}
	}

	changed, err := RepairSchema(dir, dbDir)
	if err != nil {
		t.Fatalf("RepairSchema() error: %+v", err)
	}
	if len(changed) != 0 {
		t.Errorf("changed = %v, want none", changed)
	}
}

// TestRepairSchemaAddsMissingColumns は欠けている列が補われ、一時ファイルが残らないことを検証する。
func TestRepairSchemaAddsMissingColumns(t *testing.T) {
	tables := repairedTables()
	tables["structures.csv"] = "id,type,name,republish_date\nn1,note,Note,\n"
	tables["diagrams.csv"] = "id\nd1\n"
	dir, dbDir := writeRepairFixture(t, tables)

	changed, err := RepairSchema(dir, dbDir)
	if err != nil {
		t.Fatalf("RepairSchema() error: %+v", err)
	}
	want := map[string]bool{fs.DBDir + "/structures.csv": true, fs.DBDir + "/diagrams.csv": true}
	if len(changed) != len(want) {
		t.Fatalf("changed = %v, want %v", changed, want)
	}
	for _, c := range changed {
		if !want[c] {
			t.Errorf("unexpected changed file: %s", c)
		}
	}

	checks := map[string]string{
		"structures.csv": "id,type,name,republish_date,private\nn1,note,Note,,false\n",
		"diagrams.csv":   "id,style_template\nd1,diagram_style\n",
	}
	for name, wantBody := range checks {
		buf, err := os.ReadFile(filepath.Join(dbDir, name))
		if err != nil {
			t.Fatalf("ReadFile(%s) error: %v", name, err)
		}
		if got := strings.ReplaceAll(string(buf), "\r\n", "\n"); got != wantBody {
			t.Errorf("%s =\n%q\nwant\n%q", name, got, wantBody)
		}
	}
	for _, name := range []string{"structures097.csv", "diagrams097.csv"} {
		if _, err := os.Stat(filepath.Join(dbDir, name)); !os.IsNotExist(err) {
			t.Errorf("%s should not remain (stat err=%v)", name, err)
		}
	}
}
