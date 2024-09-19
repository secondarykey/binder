package api

import (
	"binder/db/model"
	"binder/log"
	"log/slog"

	"fmt"
)

func (a *App) EditDiagram(d *model.Diagram) (*model.Diagram, error) {

	defer log.PrintTrace(log.Func("EditDiagram()"))

	//データを追加
	rtn, err := a.current.EditDiagram(d)
	if err != nil {
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}
	return rtn, nil
}

func (a *App) GetDiagram(id string) (*model.Diagram, error) {

	defer log.PrintTrace(log.Func("GetDiagram()"))

	d, err := a.current.GetDiagram(id)
	if err != nil {
		return nil, fmt.Errorf("GetDiagram() error\n%+v", err)
	}
	return d, nil
}

func (a *App) RemoveDiagram(id string) error {

	defer log.PrintTrace(log.Func("RemoveDiagram()"))

	slog.Info("RemoveDiagram()", "Id", id)
	_, err := a.current.RemoveDiagram(id)
	if err != nil {
		return fmt.Errorf("RemoveDiagram() error\n%+v", err)
	}
	return nil
}

func (a *App) OpenDiagram(id string) (string, error) {

	defer log.PrintTrace(log.Func("OpenDiagram()"))

	data, err := a.current.OpenDiagram(id)
	if err != nil {
		return "", fmt.Errorf("ReadDataText() error\n%+v", err)
	}

	return string(data), nil
}

func (a *App) SaveDiagram(id string, data string) error {

	defer log.PrintTrace(log.Func("SaveDiagram()"))

	err := a.current.SaveDiagram(id, []byte(data))
	if err != nil {
		return fmt.Errorf("WriteDataText() error\n%+v", err)
	}

	return nil
}
