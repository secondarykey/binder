package db_test

import (
	"log"
	"os"
	"path/filepath"
	"testing"

	"binder/db"
	"binder/test"
)

var configCSV = `name,detail,created_date,updated_date
"Sample Binder","Sample Description",0001-01-01T00:00:00Z,0001-01-01T00:00:00Z
`

const notesCSV = `id,name,detail,publish_date,created_date,updated_date
"test","日本語","詳細",2018-02-17T07:01:05.0Z,2018-02-17T07:01:05.0Z,2018-02-17T07:01:05.0Z
`

const dataCSV = `id,note_id,name,detail,plugin_id,publish_date,created_date,updated_date
`

func open() *db.Instance {
	inst, err := db.New(test.Dir)
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
	err := write("config.csv", configCSV)
	if err != nil {
		return err
	}
	err = write("notes.csv", notesCSV)
	if err != nil {
		return err
	}
	err = write("data.csv", dataCSV)
	if err != nil {
		return err
	}
	return nil
}

func write(n string, data string) error {
	fp, err := os.Create(filepath.Join(test.Dir, n))
	if err != nil {
		return err
	}
	defer fp.Close()
	_, err = fp.Write([]byte(data))
	if err != nil {
		return err
	}
	return nil
}

func TestMain(m *testing.M) {

	test.Clean()
	//DBを作成
	err := create()
	if err != nil {
		panic(err)
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

func TestData(t *testing.T) {

	inst := open()

	datum, err := inst.GetDatum("NotFound", "")
	if datum != nil {
		t.Errorf("GetDatum() not found is nil")
	}
	if err != nil {
		t.Errorf("db.GetDatum() not found is nil:%v", err)
	}
}
