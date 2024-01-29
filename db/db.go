package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

var DuplicateKey = fmt.Errorf("duplicate key error")

const TimeZero = "0001-01-01T00:00:00Z"

func Create(dir string) error {

	err := createTableFiles(dir)
	if err != nil {
		return xerrors.Errorf("createTableFiles() error: %w", err)
	}

	//すでに存在する場合
	inst, err := New(dir)
	if err != nil {
		return xerrors.Errorf("db.New() error: %w", err)
	}

	err = inst.Open()
	if err != nil {
		return xerrors.Errorf("inst.Open() error: %w", err)
	}

	defer inst.Close()

	err = inst.insertDefaultConfig()
	if err != nil {
		return xerrors.Errorf("inst.insertDefaultConfig() error: %w", err)
	}

	return nil
}

func createTableFiles(dir string) error {
	err := createTableFile(filepath.Join(dir, "config.csv"), configColumns)
	if err != nil {
		return xerrors.Errorf("createTableFile(config) error: %w", err)
	}
	err = createTableFile(filepath.Join(dir, "notes.csv"), notesColumns)
	if err != nil {
		return xerrors.Errorf("createTableFile(note) error: %w", err)
	}
	err = createTableFile(filepath.Join(dir, "data.csv"), dataColumns)
	if err != nil {
		return xerrors.Errorf("createTableFile(data) error: %w", err)
	}
	return nil
}

func createTableFile(file string, clm string) error {
	fp, err := os.Create(file)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write([]byte(clm))
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}

	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

type Instance struct {
	db   *sql.DB
	ctx  context.Context
	path string
}

type DBOptions func(*Instance) error

func WithContext(ctx context.Context) DBOptions {
	return func(inst *Instance) error {
		inst.ctx = ctx
		return nil
	}
}

func New(p string, opts ...DBOptions) (*Instance, error) {

	var inst Instance
	inst.db = nil
	inst.path = p

	for _, opt := range opts {
		err := opt(&inst)
		if err != nil {
			return nil, xerrors.Errorf("DBOption setting error: %w", err)
		}
	}

	if inst.ctx == nil {
		inst.ctx = context.Background()
	}
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
