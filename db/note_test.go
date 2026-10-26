package db_test

import (
	"binder/db"
	"binder/db/model"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func insertNoteWithStructure(inst *db.Instance, parentId string) (string, error) {
	id, _ := uuid.NewV7()
	noteId := id.String()

	n := model.Note{Id: noteId}
	if err := inst.InsertNote(&n, testOp()); err != nil {
		return "", err
	}

	s := model.Structure{
		Id:       noteId,
		ParentId: parentId,
		Seq:      1,
		Typ:      "note",
		Name:     "TestNote",
	}
	if err := inst.InsertStructure(&s, testOp()); err != nil {
		return "", err
	}
	return noteId, nil
}

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

	_, err := insertNoteWithStructure(inst, "")
	if err != nil {
		t.Fatalf("insertNoteWithStructure() error:%v", err)
	}

	notes, err := inst.FindUpdatedNotes("", -1, -1)
	if err != nil {
		t.Errorf("db.FindNotes() not nil:%v", err)
	}

	if len(notes) == 0 {
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

	_, err := inst.FindPublishNotes("", 10, 0)
	if err != nil {
		t.Errorf("inst.FindPublishNotes() error not nil:%v", err)
	}

}

// insertChildNotes は parentId の下に seqs の順で seq を付けたノートを作り、ID を作成順で返す。
// ノートの更新日時は作成順に付けるため、更新日時の新しい順は作成順の逆になる。
func insertChildNotes(t *testing.T, inst *db.Instance, parentId string, seqs ...int) []string {
	t.Helper()
	ids := make([]string, len(seqs))
	for i, seq := range seqs {
		id, _ := uuid.NewV7()
		ids[i] = id.String()
		if err := inst.InsertNote(&model.Note{Id: ids[i]}, testOp()); err != nil {
			t.Fatalf("InsertNote() error:%v", err)
		}
		s := model.Structure{Id: ids[i], ParentId: parentId, Seq: seq, Typ: "note", Name: "Child"}
		if err := inst.InsertStructure(&s, testOp()); err != nil {
			t.Fatalf("InsertStructure() error:%v", err)
		}
	}
	// InsertNote は updated_date を空のままにするので、更新して日時を付ける
	for _, id := range ids {
		if err := inst.UpdateNote(&model.Note{Id: id}, testOp()); err != nil {
			t.Fatalf("UpdateNote() error:%v", err)
		}
	}
	return ids
}

func noteIds(notes []*model.Note) []string {
	rtn := make([]string, len(notes))
	for i, n := range notes {
		rtn[i] = n.Id
	}
	return rtn
}

func equalIds(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// FindSeqNotes はノートの更新日時ではなく、ツリーの順（seq）で返す
func TestFindSeqNotesOrder(t *testing.T) {
	inst := open()
	defer inst.Close()

	parent, _ := uuid.NewV7()
	// 作成順は seq 1,2,3。更新日時の新しい順だと 3,2,1 になる
	ids := insertChildNotes(t, inst, parent.String(), 1, 2, 3)

	notes, err := inst.FindSeqNotes(parent.String(), -1, -1)
	if err != nil {
		t.Fatalf("FindSeqNotes() error:%v", err)
	}
	if got := noteIds(notes); !equalIds(got, ids) {
		t.Errorf("FindSeqNotes() order\n got:%v\nwant:%v", got, ids)
	}

	// 件数指定も seq の先頭から取る
	notes, err = inst.FindSeqNotes(parent.String(), 2, -1)
	if err != nil {
		t.Fatalf("FindSeqNotes(limit) error:%v", err)
	}
	if got := noteIds(notes); !equalIds(got, ids[:2]) {
		t.Errorf("FindSeqNotes(limit) order\n got:%v\nwant:%v", got, ids[:2])
	}
}

// FindPublishNotes は公開日時の新しい順で返す
func TestFindPublishNotesOrder(t *testing.T) {
	inst := open()
	defer inst.Close()

	parent, _ := uuid.NewV7()
	ids := insertChildNotes(t, inst, parent.String(), 1, 2, 3)

	// 公開順を作成順と変える: 0 → 2 → 1
	for _, i := range []int{0, 2, 1} {
		if _, err := inst.PublishStructure(ids[i], testOp()); err != nil {
			t.Fatalf("PublishStructure() error:%v", err)
		}
	}

	notes, err := inst.FindPublishNotes(parent.String(), -1, -1)
	if err != nil {
		t.Fatalf("FindPublishNotes() error:%v", err)
	}
	want := []string{ids[1], ids[2], ids[0]}
	if got := noteIds(notes); !equalIds(got, want) {
		t.Errorf("FindPublishNotes() order\n got:%v\nwant:%v", got, want)
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
