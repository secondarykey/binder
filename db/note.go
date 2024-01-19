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

func ExistNote(id string) bool {
	n, err := GetNote(id)
	if n != nil && err == nil {
		return true
	}
	return false
}

func InsertNote(n *model.Note) error {

	if n.ID == "" {
		return fmt.Errorf("ID is empty")
	}
	if ExistNote(n.ID) {
		return DuplicateKey
	}

	s := "INSERT INTO notes (id,title,detail,publish_date,created_date,updated_date) VALUES (?,?,?,?,?,?)"
	stmt, err := db.Prepare(s)
	if err != nil {
		return xerrors.Errorf("db.Prepare() error: %w", err)
	}

	_, err = stmt.Exec(n.ID, n.Title, n.Detail, n.Publish, n.Created, n.Updated)
	if err != nil {
		return xerrors.Errorf("stmt.Exec() error: %w", err)
	}
	return nil
}

func UpdateNote(n *model.Note) error {

	s := "UPDATE notes SET title = ?,detail = ?,publish_date = ?,created_date = ?,updated_date = ? WHERE id = ?"

	stmt, err := db.Prepare(s)
	if err != nil {
		return xerrors.Errorf("db.Prepare() error: %w", err)
	}
	_, err = stmt.Exec(n.Title, n.Detail, n.Publish, n.Created, n.Updated, n.ID)
	if err != nil {
		return xerrors.Errorf("stmt.Exec() error: %w", err)
	}
	return nil
}

const notesSelect = "SELECT id,title,detail,DATETIME(publish_date),DATETIME(created_date),DATETIME(updated_date) FROM notes"

func GetNote(id string) (*model.Note, error) {

	s := notesSelect + " WHERE id = ?"

	ctx := context.Background()
	r, err := getRow(ctx, s, id)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	return createNote(r)
}

func createNote(row scanner) (*model.Note, error) {

	var title sql.NullString
	var detail sql.NullString

	var n model.Note
	err := row.Scan(&n.ID, &title, &detail, &n.Publish, &n.Created, &n.Updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		} else {
			return nil, xerrors.Errorf("Scan() error: %w", err)
		}
	}
	n.Title = title.String
	n.Detail = detail.String
	return &n, nil
}

func FindNotes() ([]*model.Note, error) {

	ctx := context.Background()
	s := notesSelect + " ORDER BY updated_date desc"
	r, err := getRows(ctx, s)
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
