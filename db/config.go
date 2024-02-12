package db

import (
	"binder/db/model"
	"database/sql"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

const configColumns = "name,detail,list_num,remote,branch,auto_commit,created_date,updated_date"
const configSelect = "SELECT name,detail,list_num,remote,branch,auto_commit,DATETIME(created_date),DATETIME(updated_date) FROM config"

func (inst *Instance) GetConfig() (*model.Config, error) {

	r, err := inst.getRow(inst.ctx, configSelect)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	var c model.Config
	var detail sql.NullString
	err = r.Scan(&c.Name, &detail, &c.ListNum, &c.Remote, &c.Branch, &c.AutoCommit, &c.Created, &c.Updated)
	if err != nil {
		return nil, xerrors.Errorf("Scan() error: %w", err)
	}

	c.Name = to(c.Name)
	c.Detail = to(detail.String)
	c.Branch = to(c.Branch)

	return &c, nil
}

func (inst *Instance) insertDefaultConfig() error {
	s := "INSERT INTO config(" + configColumns + ") VALUES (?,?,?,?,?,?,?)"
	var zero time.Time
	err := inst.run(s,
		"Binder", "Detail", 5, "main", 0, zero, zero)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}

func (inst *Instance) UpdateConfig(c *model.Config) error {

	now := time.Now()
	if c.Created.IsZero() {
		c.Created = now
	}
	c.Updated = now

	s := "UPDATE config SET name = ?,detail = ?,list_num = ?,remote = ?,branch = ?, auto_commit = ?,created_date = ?,updated_date = ?"
	err := inst.run(s,
		c.Name, from(c.Detail), c.ListNum, c.Remote, c.Branch, c.AutoCommit, c.Created, c.Updated)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}

var convertMap map[string]string = map[string]string{
	"\n": "&#10;",
	"\"": "&#34;",
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
