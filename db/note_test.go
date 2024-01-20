package db_test

import (
	"binder/db"
	"binder/db/model"
	"binder/test"
	"errors"
	"testing"
)

func TestNotes(t *testing.T) {

	err := db.Open(test.Dir)
	defer db.Close()
	if err != nil {
		t.Errorf("db.Open() not nil:%v", err)
	}

	note, err := db.GetNote("test")
	if err != nil {
		t.Errorf("db.GetNote() is not error:%v", err)
	}
	if note == nil {
		t.Errorf("GetNote() not found is not nil")
	}

	//NotFound
	note, err = db.GetNote("NotFound")
	if note != nil {
		t.Errorf("GetNote() not found is nil")
	}
	if err != nil {
		t.Errorf("db.GetNote() not found is nil:%v", err)
	}
}

func TestFindNotes(t *testing.T) {
	err := db.Open(test.Dir)
	defer db.Close()
	if err != nil {
		t.Errorf("db.Open() not nil:%v", err)
	}

	notes, err := db.FindNotes(-1)
	if err != nil {
		t.Errorf("db.FindNotes() not nil:%v", err)
	}

	if len(notes) != 1 {
		t.Errorf("db.FindNotes() count error:%d", len(notes))
	}
}

func TestInsertNote(t *testing.T) {

	err := db.Open(test.Dir)
	defer db.Close()
	if err != nil {
		t.Errorf("db.Open() not nil:%v", err)
	}

	var n model.Note
	n.ID = "test2"
	n.Title = "単純テスト"
	err = db.InsertNote(&n)
	if err != nil {
		t.Errorf("db.InsertNote() not nil:%v", err)
	}

	n = model.Note{}
	n.ID = "test"
	n.Title = "キー重複テスト"
	err = db.InsertNote(&n)
	if err == nil {
		t.Errorf("db.InsertNote() is nil:%v", err)
	} else {
		if !errors.Is(err, db.DuplicateKey) {
			t.Errorf("duplicate key error not DuplicateKey:%v", err)
		}
	}

	//空のIDで登録が行えない
	//UUID 発行はあくまで上位
	n = model.Note{}
	n.ID = ""
	n.Title = "キー空テスト"
	err = db.InsertNote(&n)
	if err == nil {
		t.Errorf("db.InsertNote() empty key not nil:%v", err)
	}

}
