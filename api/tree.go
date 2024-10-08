package api

import (
	"binder"
	"binder/log"
	"fmt"
)

func (a *App) GetBinderTree() (*binder.Tree, error) {

	defer log.PrintTrace(log.Func("GetBinderTree()"))

	tree, err := a.current.GetBinderTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetBinderTree() error\n%+v", err)
	}
	return tree, nil
}

func (a *App) GetTemplateTree() (*binder.Tree, error) {

	defer log.PrintTrace(log.Func("GetTemplateTree()"))

	tree, err := a.current.GetTemplateTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetTemplateTree() error\n%+v", err)
	}

	return tree, nil
}

func (a *App) GetModifiedTree() (*binder.Tree, error) {

	defer log.PrintTrace(log.Func("GetModifiedTree()"))

	tree, err := a.current.GetModifiedTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetModifiedTree() error\n%+v", err)
	}
	return tree, nil
}

func (a *App) GetUnpublishedTree() (*binder.Tree, error) {
	defer log.PrintTrace(log.Func("GetUnpublishedTree()"))

	tree, err := a.current.GetUnpublishedTree()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetModifiedTree() error\n%+v", err)
	}
	return tree, nil
}
