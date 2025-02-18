package db_test

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"testing"

	"binder/db"
	"binder/test"
)

type tOp struct{}

func (op tOp) GetOperationId() string {
	return "Test"
}

func testOp() db.Op {
	var op tOp
	return &op
}

// DBを作成
var testPath = filepath.Join(test.Dir, "work")

func open() *db.Instance {
	inst, err := db.New(testPath)
	if err != nil {
		log.Fatal(err)
	}

	err = inst.Open()
	if err != nil {
		log.Fatal(err)
	}
	return inst
}

func create() error {
	os.Mkdir(testPath, 0666)
	err := db.Create(testPath, test.LatestVersion)
	return err
}

func TestMain(m *testing.M) {

	test.Clean()
	err := create()
	if err != nil {
		fmt.Fprintf(os.Stderr, "create() error: %+v", err)
		os.Exit(1)
	}

	code := m.Run()
	os.Exit(code)
}

func TestTables(t *testing.T) {

	tables := db.Tables()
	if len(tables) != 5 {
		t.Fatalf("too many(5) = %d", len(tables))
	}

	keys := []string{db.ConfigTableName, db.NoteTableName,
		db.DiagramTableName, db.AssetTableName, db.TemplateTableName}
	for _, v := range keys {
		want := v + ".csv"
		got := tables[v]
		if got != want {
			t.Errorf("tables value want %s got %s", want, got)
		}
	}

}

func TestDB(t *testing.T) {

	inst, err := db.New(test.Dir)
	if err != nil {
		t.Errorf("db.New() not nil:%v", err)
	}

	err = inst.Open()
	defer inst.Close()
	if err != nil {
		t.Errorf("inst.Open() not nil:%v", err)
	}
}

func TestCrete(t *testing.T) {
	dir := filepath.Join(test.Dir, "create")
	os.Mkdir(dir, 0666)

	tv := test.NewVer("1.0.0")

	err := db.Create(filepath.Join(test.Dir, "create"), tv)
	if err != nil {
		t.Errorf("db.Create() is not nil:%v", err)
	}

}
