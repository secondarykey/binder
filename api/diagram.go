package api

import (
	"binder/db/model"

	"fmt"
)

func (a *App) EditDiagram(d *model.Diagram) (*model.Diagram, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//データを追加
	rtn, err := a.current.EditDiagram(d)
	if err != nil {
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}
	return rtn, nil
}

func (a *App) GetDiagram(id string) (*model.Diagram, error) {
	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}
	d, err := a.current.GetDiagram(id)
	if err != nil {
		return nil, fmt.Errorf("GetDiagram() error\n%+v", err)
	}
	return d, nil
}

func (a *App) OpenDiagram(id string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	data, err := a.current.OpenDiagram(id)
	if err != nil {
		return "", fmt.Errorf("ReadDataText() error\n%+v", err)
	}

	return string(data), nil
}

func (a *App) SaveDiagram(id string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	err := a.current.SaveDiagram(id, []byte(data))
	if err != nil {
		return fmt.Errorf("WriteDataText() error\n%+v", err)
	}

	return nil
}
