package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

const notesColumns = "id,name,detail,publish_date,created_date,updated_date"
const notesSelect = "SELECT id,name,detail,DATETIME(publish_date),DATETIME(created_date),DATETIME(updated_date) FROM notes"

func (inst *Instance) ExistNote(id string) bool {
	n, err := inst.GetNote(id)
	if n != nil && err == nil {
		return true
	}
	return false
}

func (inst *Instance) InsertNote(n *model.Note) error {

	if n.ID == "" {
		return fmt.Errorf("ID is empty")
	}
	if inst.ExistNote(n.ID) {
		return DuplicateKey
	}

	now := time.Now()
	n.Created = now
	n.Updated = now

	s := "INSERT INTO notes(" + notesColumns + ") VALUES (?,?,?,?,?,?)"

	err := inst.run(s,
		n.ID, from(n.Name), from(n.Detail), n.Publish, n.Created, n.Updated)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}

	return nil
}

func (inst *Instance) UpdateNote(n *model.Note) error {

	now := time.Now()
	n.Updated = now

	s := "UPDATE notes SET name = ?,detail = ?,updated_date = ? WHERE id = ?"

	err := inst.run(s,
		from(n.Name), from(n.Detail), n.Updated, n.ID)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}

func (inst *Instance) GetNote(id string) (*model.Note, error) {

	s := notesSelect + " WHERE id = ?"

	r, err := inst.getRow(inst.ctx, s, id)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	return createNote(r)
}

func createNote(row scanner) (*model.Note, error) {

	var name sql.NullString
	var detail sql.NullString

	var n model.Note
	err := row.Scan(&n.ID, &name, &detail, &n.Publish, &n.Created, &n.Updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		} else {
			return nil, xerrors.Errorf("Scan() error: %w", err)
		}
	}
	n.Name = to(name.String)
	n.Detail = to(detail.String)
	return &n, nil
}

func (inst *Instance) FindNotes() ([]*model.Note, error) {
	return inst.findNotes(-1, -1, "updated_date desc", "")
}

func (inst *Instance) FindUpdatedNotes(limit int, offset int) ([]*model.Note, error) {
	return inst.findNotes(limit, offset, "updated_date desc", "")
}

func (inst *Instance) FindPublishNotes(limit int, offset int) ([]*model.Note, error) {
	return inst.findNotes(limit, offset, "publish_date desc",
		fmt.Sprintf("publish_date != '%s'", TimeZero))
}

func (inst *Instance) findNotes(limit int, offset int, order string, where string) ([]*model.Note, error) {

	ctx := context.Background()
	s := notesSelect
	if where != "" {
		s += " WHRER " + where
	}
	if order != "" {
		s += " ORDER BY " + order
	}

	if limit > 0 {
		s += fmt.Sprintf(" LIMIT %d", limit)
	}

	if offset > 0 {
		s += fmt.Sprintf(" OFFSET %d", offset)
	}

	r, err := inst.getRows(ctx, s)
	if err != nil {
		return nil, xerrors.Errorf("getRows() error: %w", err)
	}

	notes := make([]*model.Note, 0)
	for r.Next() {
		n, err := createNote(r)
		if err != nil {
			return nil, xerrors.Errorf("createNote() error: %w", err)
		} else if n == nil {
			break
		}
		notes = append(notes, n)
	}

	return notes, nil
}

func (inst *Instance) GetLatestNoteId() string {
	notes, err := inst.FindUpdatedNotes(1, -1)
	if err != nil {
		return ""
	}
	if len(notes) == 0 {
		return ""
	}
	return notes[0].ID
}
