package api

import (
	"binder/api/json"
	"binder/log"
	"strings"

	"fmt"
)

func (a *App) EditDiagram(d *json.Diagram) (*json.Diagram, error) {

	defer log.PrintTrace(log.Func("EditDiagram()"))

	//データを追加
	rtn, err := a.current.EditDiagram(d)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditData() error\n%+v", err)
	}
	return rtn, nil
}

func (a *App) GetDiagram(id string) (*json.Diagram, error) {

	defer log.PrintTrace(log.Func("GetDiagram()"))

	d, err := a.current.GetDiagram(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetDiagram() error\n%+v", err)
	}
	return d, nil
}

func (a *App) RemoveDiagram(id string) error {

	defer log.PrintTrace(log.Func("RemoveDiagram()", id))

	_, err := a.current.RemoveDiagram(id)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RemoveDiagram() error\n%+v", err)
	}
	return nil
}

func (a *App) OpenDiagram(id string) (string, error) {

	defer log.PrintTrace(log.Func("OpenDiagram()"))

	var w strings.Builder
	err := a.current.ReadDiagram(&w, id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ReadDataText() error\n%+v", err)
	}

	return w.String(), nil
}

func (a *App) SaveDiagram(id string, data string) error {

	defer log.PrintTrace(log.Func("SaveDiagram()"))

	err := a.current.SaveDiagram(id, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("WriteDataText() error\n%+v", err)
	}

	return nil
}
