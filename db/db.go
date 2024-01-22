package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

var DuplicateKey = fmt.Errorf("duplicate key error")

type scanner interface {
	Scan(dest ...any) error
}

type Instance struct {
	db   *sql.DB
	path string
}

func New(p string) (*Instance, error) {
	var inst Instance
	inst.db = nil
	inst.path = p
	return &inst, nil
}

func (inst *Instance) Close() error {
	return inst.db.Close()
}

func (inst *Instance) Open() error {
	var err error
	db, err := sql.Open("csvq", inst.path)
	if err != nil {
		return xerrors.Errorf("sql.Open() error: %w", err)
	}
	inst.db = db
	return nil
}

func (inst *Instance) getRow(ctx context.Context, sql string, args ...interface{}) (*sql.Row, error) {
	if inst.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	return inst.db.QueryRowContext(ctx, sql, args...), nil
}

func (inst *Instance) getRows(ctx context.Context, sql string, args ...interface{}) (*sql.Rows, error) {
	if inst.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	return inst.db.QueryContext(ctx, sql, args...)
}

func (inst *Instance) run(sql string, args ...interface{}) error {

	stmt, err := inst.db.Prepare(sql)
	if err != nil {
		return xerrors.Errorf("db.Prepare() error: %w", err)
	}

	_, err = stmt.Exec(args...)
	if err != nil {
		return xerrors.Errorf("stmt.Exec() error: %w", err)
	}
	return nil
}
