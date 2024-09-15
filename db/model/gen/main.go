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
	"log/slog"
	"os"
	"reflect"
	"strings"
	"text/template"
	"time"

	"golang.org/x/xerrors"
)

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
	in := []input{
		{model.Config{}, "config", "model/config.go", "../../config_dao.go"},
		{model.Note{}, "notes", "model/note.go", "../../note_dao.go"},
		{model.Diagram{}, "diagrams", "model/diagram.go", "../../diagram_dao.go"},
		{model.Asset{}, "assets", "model/asset.go", "../../asset_dao.go"},
		{model.Template{}, "templates", "model/template.go", "../../template_dao.go"},
	}

	err := run(in)
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %+v", err)
		os.Exit(1)
	}
	os.Exit(0)
}

func run(ins []input) error {
	for _, in := range ins {
		err := generate(in)
		if err != nil {
			return xerrors.Errorf("generate(%s) error: %w", in.output, err)
		}
		fmt.Println("generate:", in.output)
	}
	return nil
}

type Table struct {
	Name          string
	TableName     string
	Time          time.Time
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

func generate(in input) error {

	t, err := createTable(in)
	if err != nil {
		return xerrors.Errorf("createTable(): %w", err)
	}

	fp, err := os.Create(in.output)
	if err != nil {
		return xerrors.Errorf("os.Create(): %w", err)
	}
	defer fp.Close()

	err = tmpl.Execute(fp, t)
	if err != nil {
		return xerrors.Errorf("template Execute(): %w", err)
	}

	return nil
}

func createTable(in input) (*Table, error) {

	table := Table{}
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

func keyVariables(t *Table, comma bool) string {
	if !t.HasKey {
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
