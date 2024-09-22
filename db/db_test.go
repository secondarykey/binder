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
	_, err := db.Create(testPath)
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
	_, err := db.Create(filepath.Join(test.Dir, "create"))
	if err != nil {
		t.Errorf("db.Create() is not nil:%v", err)
	}
}
