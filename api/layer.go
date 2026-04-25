package api

import (
	"binder/api/json"
	"binder/log"
	"strings"

	"fmt"
)

func (a *App) EditLayer(l *json.Layer) (*json.Layer, error) {

	defer log.PrintTrace(log.Func("EditLayer()"))

	rtn, err := a.current.EditLayer(l)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("EditLayer() error\n%+v", err)
	}
	return rtn, nil
}

func (a *App) GetLayer(id string) (*json.Layer, error) {

	defer log.PrintTrace(log.Func("GetLayer()"))

	l, err := a.current.GetLayer(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetLayer() error\n%+v", err)
	}
	return l, nil
}

func (a *App) GetLayerWithParent(id string) (*json.Layer, error) {

	defer log.PrintTrace(log.Func("GetLayerWithParent()"))

	l, err := a.current.GetLayerWithParent(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetLayerWithParent() error\n%+v", err)
	}
	return l, nil
}

func (a *App) RemoveLayer(id string) error {

	defer log.PrintTrace(log.Func("RemoveLayer()", id))

	_, err := a.current.RemoveLayer(id)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RemoveLayer() error\n%+v", err)
	}
	return nil
}

// GetLayerContent はレイヤーの shapes JSON 文字列を返す。
func (a *App) GetLayerContent(id string) (string, error) {

	defer log.PrintTrace(log.Func("GetLayerContent()"))

	var w strings.Builder
	err := a.current.ReadLayer(&w, id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("ReadLayer() error\n%+v", err)
	}
	return w.String(), nil
}

// SaveLayerContent は shapes JSON を layers/{id}.json に保存する。
func (a *App) SaveLayerContent(id string, data string) error {

	defer log.PrintTrace(log.Func("SaveLayerContent()"))

	err := a.current.SaveLayer(id, []byte(data))
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveLayer() error\n%+v", err)
	}
	return nil
}

// GetLayerSVG はライブプレビュー用のSVG文字列を返す。
func (a *App) GetLayerSVG(id string) (string, error) {

	defer log.PrintTrace(log.Func("GetLayerSVG()"))

	svg, err := a.current.BuildLayerSVGForId(id)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("BuildLayerSVGForId() error\n%+v", err)
	}
	return svg, nil
}
