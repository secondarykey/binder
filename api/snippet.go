package api

import (
	"binder/log"
	"binder/settings"
	"fmt"
)

func (app *App) GetSnippets() (*settings.Snippets, error) {

	defer log.PrintTrace(log.Func("GetSnippets()"))

	s, err := settings.LoadSnippets()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetSnippets() error:\n%+v", err)
	}
	return s, nil
}

func (app *App) SaveSnippets(s *settings.Snippets) error {

	defer log.PrintTrace(log.Func("SaveSnippets()"))

	if err := settings.SaveSnippets(s); err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveSnippets() error:\n%+v", err)
	}
	return nil
}
