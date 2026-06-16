package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
)

func (a *App) GetStructure(id string) (*json.Structure, error) {
	defer log.PrintTrace(log.Func("GetStructure()"))
	s, err := a.current.GetStructure(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetStructure() error\n%+v", err)
	}
	return s.To(), nil
}
