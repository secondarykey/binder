package api

import (
	"binder/log"
	"binder/snippet"
	"fmt"
)

func (a *App) GetSnippets() (*snippet.Snippets, error) {

	defer log.PrintTrace(log.Func("GetSnippets()"))

	s, err := snippet.Load()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetSnippets() error:\n%+v", err)
	}
	return s, nil
}

func (a *App) SaveSnippets(s *snippet.Snippets) error {

	defer log.PrintTrace(log.Func("SaveSnippets()"))

	if err := snippet.Save(s); err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("SaveSnippets() error:\n%+v", err)
	}
	return nil
}
