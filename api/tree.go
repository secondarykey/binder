package api

import (
	"binder/api/json"
	"binder/log"
	"fmt"
)

func (a *App) GetBinderTree() (*json.Tree, error) {

	defer log.PrintTrace(log.Func("GetBinderTree()"))

	tree, err := a.current.GetBinderTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetBinderTree() error\n%+v", err)
	}
	return tree, nil
}

func (a *App) GetTemplateTree() (*json.Tree, error) {

	defer log.PrintTrace(log.Func("GetTemplateTree()"))

	tree, err := a.current.GetTemplateTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetTemplateTree() error\n%+v", err)
	}

	return tree, nil
}

func (a *App) GetModifiedTree() (*json.Tree, error) {

	defer log.PrintTrace(log.Func("GetModifiedTree()"))

	tree, err := a.current.GetModifiedTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetModifiedTree() error\n%+v", err)
	}
	return tree, nil
}

func (a *App) MoveNode(parentId string, childIds []string) error {

	defer log.PrintTrace(log.Func("MoveNode()"))

	err := a.current.MoveNode(parentId, childIds)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("MoveNode() error\n%+v", err)
	}
	return nil
}

func (a *App) GetUnpublishedTree() (*json.Tree, error) {
	defer log.PrintTrace(log.Func("GetUnpublishedTree()"))

	tree, err := a.current.GetUnpublishedTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetModifiedTree() error\n%+v", err)
	}
	return tree, nil
}
