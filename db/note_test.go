package db_test

import (
	"binder/db"
	"binder/db/model"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestNotes(t *testing.T) {

	inst := open()
	defer inst.Close()

	var n model.Note
	id, _ := uuid.NewV7()
	n.Id = id.String()

	err := inst.InsertNote(&n, testOp())
	if err != nil {
		t.Errorf("db.InsertNote() not nil:%v", err)
	}

	note, err := inst.GetNote(n.Id)
	if err != nil {
		t.Errorf("db.GetNote() is not error:%v", err)
	}
	if note == nil {
		t.Errorf("GetNote() not found is not nil")
	}

	//NotFound
	note, err = inst.GetNote("NotFound")
	if err != nil {
		if !db.IsNotExist(err) {
			t.Errorf("db.GetNote() not found is nil:%v", err)
		}
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
	n.Id = "test2"

	err := inst.InsertNote(&n, testOp())
	if err != nil {
		t.Errorf("db.InsertNote() not nil:%v", err)
	}

	n = model.Note{}
	n.Id = "test2"
	err = inst.InsertNote(&n, testOp())
	if err == nil {
		t.Errorf("db.InsertNote() is nil:%v", err)
	} else {
		if !errors.Is(err, db.DuplicateKey) {
			t.Errorf("duplicate key error not DuplicateKey:%v", err)
		}
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

func TestFindInNoteId(t *testing.T) {
	inst := open()
	defer inst.Close()

	notes, err := inst.FindInNoteId("aaa", "bbb")
	if err != nil {
		t.Errorf("inst.FindInNoteId() error not nil:%v", err)
	}

	if len(notes) != 0 {
		t.Errorf("inst.FindInNoteId() not zero[%d]", len(notes))
	}
}
