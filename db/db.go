package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

func init() {
}

var DuplicateKey = fmt.Errorf("duplicate key error")

const TimeZero = "0001-01-01T00:00:00Z"

func Create(dir string) ([]string, error) {

	//ファイルチェック
	//すでに存在する場合
	files, err := createTableFiles(dir)
	if err != nil {
		return nil, xerrors.Errorf("createTableFiles() error: %w", err)
	}

	inst, err := New(dir)
	if err != nil {
		return nil, xerrors.Errorf("db.New() error: %w", err)
	}
	err = inst.Open()
	if err != nil {
		return nil, xerrors.Errorf("inst.Open() error: %w", err)
	}
	defer inst.Close()

	err = inst.insertDefaultConfig()
	if err != nil {
		return nil, xerrors.Errorf("inst.insertDefaultConfig() error: %w", err)
	}

	return files, nil
}

func createTableFiles(dir string) ([]string, error) {
	var err error
	var fn string
	var files []string

	fn, err = createConfigTable(dir)
	if err != nil {
		return nil, xerrors.Errorf("createConfigTable() error: %w", err)
	}
	files = append(files, fn)
	fn, err = createNoteTable(dir)
	if err != nil {
		return nil, xerrors.Errorf("createNoteTable() error: %w", err)
	}
	files = append(files, fn)
	fn, err = createDiagramTable(dir)
	if err != nil {
		return nil, xerrors.Errorf("createDiagramTable() error: %w", err)
	}
	files = append(files, fn)
	fn, err = createAssetTable(dir)
	if err != nil {
		return nil, xerrors.Errorf("createAssetTable() error: %w", err)
	}
	files = append(files, fn)
	fn, err = createTemplateTable(dir)
	if err != nil {
		return nil, xerrors.Errorf("createTemplateTable() error: %w", err)
	}
	files = append(files, fn)
	return files, nil
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

type Op interface {
	GetOperationId() string
}

type sysOp struct{}

func (op sysOp) GetOperationId() string {
	return "App"
}

func createSystemOperation() Op {
	var op sysOp
	return &op
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

func (inst *Instance) run(sql string, args ...interface{}) (int64, error) {

	stmt, err := inst.db.Prepare(sql)
	if err != nil {
		return -1, xerrors.Errorf("db.Prepare() error: %w", err)
	}

	ret, err := stmt.ExecContext(inst.ctx, args...)
	if err != nil {
		return -1, xerrors.Errorf("stmt.Exec() error: %w", err)
	}
	return ret.RowsAffected()
}

var convertMap map[string]string = map[string]string{
	"\n": "&#10;",
	" ":  "&#32;",
	"\"": "&#34;",
	",":  "&#44;",
}

func from(src string) string {
	if src == "" {
		return ""
	}
	ret := src
	for key, val := range convertMap {
		ret = strings.ReplaceAll(ret, key, val)
	}
	return ret
}

func to(src string) string {
	if src == "" {
		return ""
	}
	ret := src
	for key, val := range convertMap {
		ret = strings.ReplaceAll(ret, val, key)
	}
	return ret
}
