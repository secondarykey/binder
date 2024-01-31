package db_test

import (
	"binder/db"
	"binder/db/model"
	"errors"
	"testing"
)

func TestNotes(t *testing.T) {

	inst := open()
	defer inst.Close()

	note, err := inst.GetNote("test")
	if err != nil {
		t.Errorf("db.GetNote() is not error:%v", err)
	}
	if note == nil {
		t.Errorf("GetNote() not found is not nil")
	}

	//NotFound
	note, err = inst.GetNote("NotFound")
	if note != nil {
		t.Errorf("GetNote() not found is nil")
	}
	if err != nil {
		t.Errorf("db.GetNote() not found is nil:%v", err)
	}
}

func TestFindNotes(t *testing.T) {

	inst := open()
	defer inst.Close()

	notes, err := inst.FindUpdatedNotes(-1, -1)
	if err != nil {
		t.Errorf("db.FindNotes() not nil:%v", err)
	}

	if len(notes) != 1 {
		t.Errorf("db.FindNotes() count error:%d", len(notes))
	}
}

func TestInsertNote(t *testing.T) {

	inst := open()
	defer inst.Close()

	var n model.Note
	n.ID = "test2"
	n.Name = "単純テスト"

	err := inst.InsertNote(&n)
	if err != nil {
		t.Errorf("db.InsertNote() not nil:%v", err)
	}

	n = model.Note{}
	n.ID = "test"
	n.Name = "キー重複テスト"
	err = inst.InsertNote(&n)
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
	n.Name = "キー空テスト"
	err = inst.InsertNote(&n)
	if err == nil {
		t.Errorf("db.InsertNote() empty key not nil:%v", err)
	}
}

func TestFindPublish(t *testing.T) {
	inst := open()
	defer inst.Close()

	_, err := inst.FindPublishNotes(10, 0)
	if err != nil {
		t.Errorf("inst.FindPublishNotes() error not nil:%v", err)
	}

}
