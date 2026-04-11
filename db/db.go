package db

import (
	. "binder/internal"
	"binder/log"
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

var tables map[string]string

func init() {
	tables = make(map[string]string)
	tables[NoteTableName] = NoteTableName + ".csv"
	tables[DiagramTableName] = DiagramTableName + ".csv"
	tables[AssetTableName] = AssetTableName + ".csv"
	tables[TemplateTableName] = TemplateTableName + ".csv"
	tables[StructureTableName] = StructureTableName + ".csv"
}

var DuplicateKey = fmt.Errorf("duplicate key error")
var DuplicateAlias = fmt.Errorf("duplicate alias error")

const TimeZero = "0001-01-01T00:00:00Z"

type NotExistError struct {
	id   string
	name string
}

func IsNotExist(err error) bool {
	if errors.As(err, &NotExistError{}) {
		return true
	}
	return false
}

func newNotExistError(id, name string) error {
	var err NotExistError
	err.id = id
	err.name = name
	return err
}

func (e NotExistError) Error() string {
	return fmt.Sprintf("%s with this id(%s) does not exist", e.name, e.id)
}

func Tables() map[string]string {
	return tables
}

// ConfigTableName は0.4.5で廃止されたconfigテーブルの名前。
// db/config.csv の削除など移行処理で参照する用途に限り使用する。
const ConfigTableName = "config"

// 0.0.0 検索用
const SchemaFileSuffix = "_schema"
const SchemaFile = "schema.version"

func SchemaVersion(dir string) (*Version, error) {

	v := loadSchemaFile(dir)
	ver, err := NewVersion(v)
	if err != nil {
		return nil, xerrors.Errorf("NewVersion() error: %w", err)
	}
	return ver, nil
}

func Create(dir string, version *Version) error {

	//ファイルチェック
	//すでに存在する場合
	err := createTableFiles(dir)
	if err != nil {
		return xerrors.Errorf("createTableFiles() error: %w", err)
	}

	return nil
}

func createTableFiles(dir string) error {

	var err error

	err = createNoteTable(dir)
	if err != nil {
		return xerrors.Errorf("createNoteTable() error: %w", err)
	}

	err = createDiagramTable(dir)
	if err != nil {
		return xerrors.Errorf("createDiagramTable() error: %w", err)
	}

	err = createAssetTable(dir)
	if err != nil {
		return xerrors.Errorf("createAssetTable() error: %w", err)
	}

	err = createTemplateTable(dir)
	if err != nil {
		return xerrors.Errorf("createTemplateTable() error: %w", err)
	}

	err = createStructureTable(dir)
	if err != nil {
		return xerrors.Errorf("createStructureTable() error: %w", err)
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

func CreateSchemaFile(dir string, ver *Version) error {

	//既存バージョンがないか確認

	//あった場合エラー
	err := createSchemaFile(dir, ver)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	return nil
}

func createSchemaFile(dir string, ver *Version) error {

	f := filepath.Join(dir, SchemaFile)

	fp, err := os.Create(f)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write([]byte(ver.String()))
	if err != nil {
		return xerrors.Errorf("os.Write() error: %w", err)
	}
	return nil
}

// スキーマファイルからバージョンを取得
func loadSchemaFile(dir string) string {

	p := filepath.Join(dir, SchemaFile)
	//存在しない場合
	if _, err := os.Stat(p); err != nil {
		return loadOldSchemaFile(dir)
	}

	fp, err := os.Open(p)
	if err != nil {
		return "0.0.0"
	}
	defer fp.Close()

	s := bufio.NewScanner(fp)
	if !s.Scan() {
		return "0.0.0"
	}

	return s.Text()
}

// Deprecated: old version
func loadOldSchemaFile(dir string) string {

	files, err := filepath.Glob(filepath.Join(dir, "*"+SchemaFileSuffix))
	if err != nil {
		return "0.0.0"
	}

	v := "0.0.0"
	//存在する場合
	if len(files) >= 1 {
		if len(files) > 1 {
			log.Warn("schema file duplicate:" + dir)
		}

		f := files[0]
		n := filepath.Base(f)
		//ファイル名
		v = strings.Replace(n, SchemaFileSuffix, "", 1)
	}
	return v
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

func csvQ(data []interface{}) string {
	q := make([]string, len(data))
	for idx := range data {
		q[idx] = "?"
	}
	return strings.Join(q, ",")
}
