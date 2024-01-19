package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

var db *sql.DB = nil
var DuplicateKey = fmt.Errorf("duplicate key error")

type scanner interface {
	Scan(dest ...any) error
}

type Instance struct {
	db *sql.DB
}

func New(p string) (*Instance, error) {
	return nil, nil
}

func (inst *Instance) Close() error {
	return inst.db.Close()
}

func Open(p string) error {
	var err error
	db, err = sql.Open("csvq", p)
	if err != nil {
		return xerrors.Errorf("sql.Open() error: %w", err)
	}
	return nil
}

func Close() error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	err := db.Close()
	if err != nil {
		return xerrors.Errorf("db.Close() error: %w", err)
	}
	return nil
}

func getRow(ctx context.Context, sql string, args ...interface{}) (*sql.Row, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	return db.QueryRowContext(ctx, sql, args...), nil
}

func getRows(ctx context.Context, sql string, args ...interface{}) (*sql.Rows, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	return db.QueryContext(ctx, sql, args...)
}
