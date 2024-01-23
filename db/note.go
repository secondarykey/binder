package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

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

	s := "INSERT INTO notes (id,name,detail,publish_date,created_date,updated_date) VALUES (?,?,?,?,?,?)"

	err := inst.run(s,
		n.ID, n.Name, n.Detail, n.Publish, n.Created, n.Updated)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}

	return nil
}

func (inst *Instance) UpdateNote(n *model.Note) error {

	s := "UPDATE notes SET name = ?,detail = ?,publish_date = ?,created_date = ?,updated_date = ? WHERE id = ?"

	err := inst.run(s,
		n.Name, n.Detail, n.Publish, n.Created, n.Updated, n.ID)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}

const notesSelect = "SELECT id,name,detail,DATETIME(publish_date),DATETIME(created_date),DATETIME(updated_date) FROM notes"

func (inst *Instance) GetNote(id string) (*model.Note, error) {

	s := notesSelect + " WHERE id = ?"

	ctx := context.Background()
	r, err := inst.getRow(ctx, s, id)
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
	n.Name = name.String
	n.Detail = detail.String
	return &n, nil
}

func (inst *Instance) FindNotes(limit int) ([]*model.Note, error) {

	ctx := context.Background()
	s := notesSelect + " ORDER BY updated_date desc"
	if limit > 0 {
		s += fmt.Sprintf(" LIMIT %d", limit)
	}
	r, err := inst.getRows(ctx, s)
	if err != nil {
		return nil, xerrors.Errorf("getRows() error: %w", err)
	}

	var notes []*model.Note
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
	notes, err := inst.FindNotes(1)
	if err != nil {
		return ""
	}
	if len(notes) == 0 {
		return ""
	}
	return notes[0].ID
}
