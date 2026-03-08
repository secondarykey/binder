// 当初,generateで
// go run ./gen/main.go asset
// のように書いていたけど、クローズドなので
// astでコメントを探索して,構造体で解析するより
// reflectで処理した方が早いと判断
package main

import (
	"binder/db/model"
	_ "embed"
	"fmt"
	"go/parser"
	"go/printer"
	"go/token"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"text/template"
	"time"

	"golang.org/x/xerrors"
)

const schemaVersion = "0.3.3"

type input struct {
	object interface{}
	name   string
	base   string
	output string
}

//go:embed dao.tmpl
var daoTmpl string
var tmpl *template.Template

func init() {
	var err error
	tmpl = template.New("").Funcs(map[string]any{
		"columns":         columns,
		"keyArgs":         keyArgs,
		"keyVariables":    keyVariables,
		"keyStructure":    keyStructure,
		"selectColumns":   selectColumns,
		"selectWhere":     updateWhere,
		"variableNames":   variableNames,
		"defineString":    defineString,
		"assignString":    assignString,
		"insertColumns":   insertColumns,
		"insertArgs":      insertArgs,
		"insertVariables": insertVariables,
		"updateSet":       updateSet,
		"updateWhere":     updateWhere,
		"updateVariables": updateVariables,
		"deleteWhere":     updateWhere,
		"deleteVariables": deleteVariables,
	})
	tmpl, err = tmpl.Parse(daoTmpl)
	if err != nil {
		slog.Error(fmt.Sprintf("template Parse error: %v", err))
	}
}

func main() {
	//outputは物理位置だが
	//baseはヘッダに書くだけなので相対のパッケージ位置でよい
	in := []input{
		{model.Config{}, "config", "db/model/config.go", "db/config_dao.go"},
		{model.Note{}, "notes", "db/model/note.go", "db/note_dao.go"},
		{model.Diagram{}, "diagrams", "db/model/diagram.go", "db/diagram_dao.go"},
		{model.Asset{}, "assets", "db/model/asset.go", "db/asset_dao.go"},
		{model.Template{}, "templates", "db/model/template.go", "db/template_dao.go"},
		{model.Structure{}, "structures", "db/model/structure.go", "db/structure_dao.go"},
	}

	err := run(in)
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %+v", err)
		os.Exit(1)
	}
	os.Exit(0)
}

func run(ins []input) error {

	//ワーク位置から、binderディレクトリを算出
	wd, err := os.Getwd()
	if err != nil {
		return xerrors.Errorf("os.Getwd() error: %w", err)
	}
	root := getRoot(wd)

	for _, in := range ins {
		fn := filepath.Join(root, in.output)
		in.output = fn

		buf, err := createFileData(in)
		if err != nil {
			return xerrors.Errorf("createFileData(%s) error: %w", in.output, err)
		}

		//FMT
		err = generate(in.output, buf)
		if err != nil {
			return xerrors.Errorf("generate(%s) error: %w", in.output, err)
		}

		fmt.Println("generate:", in.output)
	}
	return nil
}

func getRoot(p string) string {
	b := filepath.Base(p)
	if b == "binder" {
		//TODO binderではなく、go.modのある位置がいいかも
		return p
	}

	dir := filepath.Dir(p)
	return getRoot(dir)
}

type Table struct {
	Name          string
	TableName     string
	Time          time.Time
	Version       string
	Base          string
	HasKey        bool
	Columns       []Column
	InsertColumns []Column
	UpdateColumns []Column
}

type Column struct {
	Name         string
	ColName      string
	VariableName string

	Key    bool
	Insert bool
	Update bool

	Type     reflect.Type
	TypeName string
}

// 出力処理
func createFileData(in input) (*strings.Builder, error) {

	var buf strings.Builder

	t, err := createTable(in)
	if err != nil {
		return nil, xerrors.Errorf("createTable(): %w", err)
	}

	err = tmpl.Execute(&buf, t)
	if err != nil {
		return nil, xerrors.Errorf("template Execute(): %w", err)
	}

	return &buf, nil
}

func generate(fn string, buf *strings.Builder) error {

	fp, err := os.Create(fn)
	if err != nil {
		return xerrors.Errorf("os.Create(): %w", err)
	}
	defer fp.Close()

	source := buf.String()

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", buf.String(), parser.ParseComments)
	if err != nil {

		fmt.Printf("parser.ParseFile() error: %v\n", err)

		_, err = fp.Write([]byte(source))
		if err != nil {
			return xerrors.Errorf("Write() error: %w", err)
		}
		return nil
	}

	err = printer.Fprint(fp, fset, node)
	if err != nil {
		return xerrors.Errorf("printer.Fprint() error: %w", err)
	}

	return nil
}

func createTable(in input) (*Table, error) {

	table := Table{}
	table.Version = schemaVersion
	table.Time = time.Now()
	table.Base = in.base
	table.TableName = in.name

	t := reflect.TypeOf(in.object)

	table.Name = t.Name()
	table.Columns = make([]Column, 0)

	have := false
	// typename = tablename = filename.csv
	//fields
	for i := 0; i < t.NumField(); i++ {

		f := t.Field(i)
		t := f.Tag.Get("db")
		//DBで利用しない
		if t == "-" || t == "" {
			continue
		}

		//fmt.Printf("%s = %s\n", f.Name, f.Tag.Get("db"))
		var col Column
		col.Key = false
		col.Insert = true
		col.Update = true

		n := t
		d := strings.Split(t, ":")
		if len(d) > 1 {
			n = d[0]
			k := d[1]
			if k == "key" {
				col.Key = true
				have = true
				col.Update = false
			} else if k == "insert" {
				col.Update = false
			} else if k == "update" {
				col.Insert = false
			}
		}

		col.Name = f.Name
		col.VariableName = strings.ToLower(f.Name[0:1]) + f.Name[1:]
		col.ColName = n
		col.Type = f.Type
		col.TypeName = f.Type.Name()

		table.Columns = append(table.Columns, col)
		if col.Insert {
			table.InsertColumns = append(table.Columns, col)
		}
		if col.Update {
			table.UpdateColumns = append(table.Columns, col)
		}
	}
	table.HasKey = have

	return &table, nil
}

func selectColumns(t *Table) string {
	var buf strings.Builder
	for idx, col := range t.Columns {
		if idx != 0 {
			buf.WriteString(",")
		}
		switch col.TypeName {
		case "Time":
			buf.WriteString(fmt.Sprintf("DATETIME(%s)", col.ColName))
		default:
			buf.WriteString(col.ColName)
		}
	}
	return buf.String()
}

func columns(t *Table) string {
	var buf strings.Builder
	for idx, col := range t.Columns {
		if idx != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(col.ColName)
	}
	return buf.String()
}

func insertColumns(t *Table) string {
	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Insert {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(col.ColName)
	}
	return buf.String()
}

func insertArgs(t *Table) string {
	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Insert {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString("?")
	}
	return buf.String()
}

func insertVariables(t *Table) string {
	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Insert {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("m.%s", col.Name))
	}
	return buf.String()
}

func updateSet(t *Table) string {
	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Update {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("%s = ?", col.ColName))
	}
	return buf.String()
}

func updateWhere(t *Table) string {
	if !t.HasKey {
		return ""
	}

	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Key {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(" AND ")
		}
		buf.WriteString(fmt.Sprintf("%s = ?", col.ColName))
	}
	return buf.String()
}

func updateVariables(t *Table) string {
	var buf strings.Builder

	keys := ""
	for _, col := range t.Columns {
		if !col.Update && !col.Key {
			continue
		}

		f := ","
		switch col.TypeName {
		case "string":
			f += "from(m.%s)"
		default:
			f += "m.%s"
		}
		val := fmt.Sprintf(f, col.Name)

		if col.Key {
			keys += val
		} else {
			buf.WriteString(val)
		}
	}

	buf.WriteString(keys)

	return buf.String()
}

func variableNames(t *Table) string {
	var buf strings.Builder
	for idx, col := range t.Columns {
		if idx != 0 {
			buf.WriteString(",")
		}
		switch col.TypeName {
		case "string":
			buf.WriteString("&" + col.VariableName)
		default:
			buf.WriteString(fmt.Sprintf("&m.%s", col.Name))
		}
	}
	return buf.String()
}

func defineString(c Column) string {
	switch c.TypeName {
	case "string":
		return fmt.Sprintf("    var %s sql.NullString\n", c.VariableName)
	}
	return ""
}

func deleteVariables(t *Table) string {
	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Key {
			continue
		}

		buf.WriteString(",")
		f := ""
		switch col.TypeName {
		case "string":
			f = "from(%s)"
		default:
			f = "%s"
		}
		val := fmt.Sprintf(f, col.VariableName)
		buf.WriteString(val)
	}

	return buf.String()
}

func assignString(c Column) string {
	switch c.TypeName {
	case "string":
		return fmt.Sprintf("    m.%s = to(%s.String)\n", c.Name, c.VariableName)
	}
	return ""
}

func keyArgs(t *Table) string {
	if !t.HasKey {
		return ""
	}

	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Key {
			continue
		}
		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("%s %v", col.VariableName, col.Type))
	}
	return buf.String()
}

func keyVariables(t *Table, comma bool, empty bool) string {

	if !t.HasKey {
		if empty {
			return "\"\""
		}
		return ""
	}

	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Key {
			continue
		}

		if comma || buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("%s", col.VariableName))
	}

	return buf.String()
}

// 構造体を引数にする場合に利用
func keyStructure(t *Table) string {
	if !t.HasKey {
		return ""
	}

	var buf strings.Builder
	for _, col := range t.Columns {
		if !col.Key {
			continue
		}

		if buf.Len() != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("m.%s", col.Name))
	}
	return buf.String()
}
