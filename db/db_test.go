package db_test

import (
	"os"
	"path/filepath"
	"testing"

	"binder/db"
	"binder/test"
)

var configCSV = `name,description,created_date,updated_date
"Sample Binder","Sample Description",0001-01-01T00:00:00Z,0001-01-01T00:00:00Z
`

const notesCSV = `note_id,title,detail,publish_date,created_date,updated_date
"test","日本語","詳細",2018-02-17T07:01:05.0Z,2018-02-17T07:01:05.0Z,2018-02-17T07:01:05.0Z
`

const dataCSV = `id,note_id,name,detail,plugin_id,publish_date,created_date,updated_date
`

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
	err := db.Open(test.Dir)
	defer db.Close()
	if err != nil {
		t.Errorf("db.Open() not nil:%v", err)
	}
}

func TestData(t *testing.T) {

	err := db.Open(test.Dir)
	defer db.Close()

	datum, err := db.GetDatum("NotFound", "")
	if datum != nil {
		t.Errorf("GetDatum() not found is nil")
	}
	if err != nil {
		t.Errorf("db.GetDatum() not found is nil:%v", err)
	}
}
