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

const dataSelect = "SELECT id,note_id,name,plugin_id,detail,DATETIME(publish_date),DATETIME(created_date),DATETIME(updated_date) FROM data"

func ExistDatum(id string, noteId string) bool {
	d, err := GetDatum(id, noteId)
	if d != nil && err == nil {
		return true
	}
	return false
}

func createDatum(row scanner) (*model.Datum, error) {

	var noteId sql.NullString
	var detail sql.NullString
	var pluginId sql.NullString

	var d model.Datum
	err := row.Scan(&d.ID, &noteId, &d.Name, &detail, &pluginId, &d.Publish, &d.Created, &d.Updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		} else {
			return nil, xerrors.Errorf("Scan() error: %w", err)
		}
	}

	d.NoteId = noteId.String
	d.Detail = detail.String
	d.PluginId = pluginId.String

	return &d, nil
}

func FindData() ([]*model.Datum, error) {
	s := dataSelect + " ORDER BY updated_date"

	ctx := context.Background()
	r, err := getRows(ctx, s)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	var data []*model.Datum
	for r.Next() {
		d, err := createDatum(r)
		if err != nil {
			return nil, xerrors.Errorf("createDatum() error: %w", err)
		} else if d == nil {
			break
		}
		data = append(data, d)
	}
	return data, nil
}

func GetDatum(id string, noteId string) (*model.Datum, error) {

	args := make([]interface{}, 0, 2)
	s := dataSelect + " WHERE id = ?"

	args = append(args, id)
	if noteId != "" {
		s += fmt.Sprintf(" AND note_id = ?")
		args = append(args, noteId)
	}

	ctx := context.Background()
	r, err := getRow(ctx, s, args...)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	return createDatum(r)
}

func InsertDatum(d *model.Datum) error {

	if d.ID == "" {
		return fmt.Errorf("ID is empty")
	}

	if ExistDatum(d.ID, d.NoteId) {
		return DuplicateKey
	}

	s := "INSERT INTO data (id,note_id,name,detail,plugin_id,publish_date,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?)"
	stmt, err := db.Prepare(s)
	if err != nil {
		return xerrors.Errorf("db.Prepare() error: %w", err)
	}

	_, err = stmt.Exec(d.ID, d.NoteId, d.Name, d.Detail, d.PluginId, d.Publish, d.Created, d.Updated)
	if err != nil {
		return xerrors.Errorf("stmt.Exec() error: %w", err)
	}

	return nil
}

func UpdateDatum(d *model.Datum) error {

	s := "UPDATE data SET note_id = ?,name = ?,detail = ?,plugin_id = ?,publish_date = ?,created_date = ?,updated_date = ? WHERE id = ?"
	stmt, err := db.Prepare(s)
	if err != nil {
		return xerrors.Errorf("db.Prepare() error: %w", err)
	}

	_, err = stmt.Exec(d.NoteId, d.Name, d.Detail, d.PluginId, d.Publish, d.Created, d.Updated, d.ID)
	if err != nil {
		return xerrors.Errorf("stmt.Exec() error: %w", err)
	}
	return nil
}
