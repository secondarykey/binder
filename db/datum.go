package db

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

const dataColumns = "id,note_id,name,plugin_id,detail,publish_date,created_date,updated_date"
const dataSelect = "SELECT id,note_id,name,plugin_id,detail,DATETIME(publish_date),DATETIME(created_date),DATETIME(updated_date) FROM data"

func (inst *Instance) ExistDatum(id string, noteId string) bool {
	d, err := inst.GetDatum(id, noteId)
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
	err := row.Scan(&d.ID, &noteId, &d.Name, &pluginId, &detail, &d.Publish, &d.Created, &d.Updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		} else {
			return nil, xerrors.Errorf("Scan() error: %w", err)
		}
	}

	d.NoteId = noteId.String
	d.PluginId = pluginId.String

	d.Detail = to(detail.String)
	d.Name = to(d.Name)

	return &d, nil
}

func (inst *Instance) FindData() ([]*model.Datum, error) {
	s := dataSelect + " ORDER BY updated_date"

	r, err := inst.getRows(inst.ctx, s)
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

func (inst *Instance) GetDatum(id string, noteId string) (*model.Datum, error) {

	args := make([]interface{}, 0, 2)
	s := dataSelect + " WHERE id = ?"

	args = append(args, id)
	if noteId != "" {
		s += fmt.Sprintf(" AND note_id = ?")
		args = append(args, noteId)
	}

	r, err := inst.getRow(inst.ctx, s, args...)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	return createDatum(r)
}

func (inst *Instance) InsertDatum(d *model.Datum) error {

	if d.ID == "" {
		return fmt.Errorf("ID is empty")
	}

	if inst.ExistDatum(d.ID, d.NoteId) {
		return DuplicateKey
	}

	now := time.Now()
	d.Created = now
	d.Updated = now

	s := "INSERT INTO data(" + dataColumns + ") VALUES (?,?,?,?,?,?,?,?)"

	err := inst.run(s, d.ID, d.NoteId, from(d.Name), from(d.Detail), d.PluginId, d.Publish, d.Created, d.Updated)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}

func (inst *Instance) UpdateDatum(d *model.Datum) error {

	now := time.Now()
	d.Updated = now

	s := "UPDATE data SET note_id = ?,name = ?,detail = ?,plugin_id = ?,updated_date = ? WHERE id = ? AND note_id = ?"
	err := inst.run(s,
		d.NoteId, from(d.Name), from(d.Detail), d.PluginId, d.Updated, d.ID, d.NoteId)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}

	return nil
}

func (inst *Instance) PublishDatum(id, noteId string) error {
	now := time.Now()
	s := "UPDATE data SET publish_date = ? WHERE id = ? AND note_id = ?"
	err := inst.run(s,
		now, id, noteId)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}
