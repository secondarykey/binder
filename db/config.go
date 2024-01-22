package db

import (
	"binder/db/model"
	"context"
	"time"

	"golang.org/x/xerrors"
)

const configSelect = "SELECT name,description,DATETIME(created_date),DATETIME(updated_date) FROM config"

func (inst *Instance) GetConfig() (*model.Config, error) {

	ctx := context.Background()

	r, err := inst.getRow(ctx, configSelect)
	if err != nil {
		return nil, xerrors.Errorf("getRow() error: %w", err)
	}

	var c model.Config
	err = r.Scan(&c.Name, &c.Description, &c.Created, &c.Updated)
	if err != nil {
		return nil, xerrors.Errorf("Scan() error: %w", err)
	}

	return &c, nil
}

func (inst *Instance) UpdateConfig(c *model.Config) error {

	now := time.Now()
	if c.Created.IsZero() {
		c.Created = now
	}
	c.Updated = now

	s := "UPDATE config SET name = ?,description = ?,created_date = ?,updated_date = ?"
	err := inst.run(s,
		c.Name, c.Description, c.Created, c.Updated)
	if err != nil {
		return xerrors.Errorf("run() error: %w", err)
	}
	return nil
}
