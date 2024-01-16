package main

import (
	"binder"
	"binder/db"
	"binder/db/model"
	"binder/fs"
	"errors"
	"io"

	"context"
	"fmt"
	stdFs "io/fs"
	"log"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	current *fs.Binder
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetResource() (*binder.Resource, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	r, err := binder.CreateResource()
	if err != nil {
		return nil, fmt.Errorf("GetResource() error\n%+v", err)
	}

	return r, nil
}

func (a *App) CreateNote(noteId string, name string, imageName string) (*model.Note, error) {

	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//ノートを追加
	n, err := a.current.RegisterNote(noteId, name, imageName)
	if err != nil {
		if errors.Is(err, db.DuplicateKey) {
			return nil, fmt.Errorf("Note Id[%s] exists.", noteId)
		}
		return nil, fmt.Errorf("RegisterNote error\n%+v", err)
	}

	return n, nil
}

func (a *App) OpenNote(noteId string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	n := fs.NoteTextFile(noteId)
	data, err := stdFs.ReadFile(a.current, n)
	if err != nil {
		return "", fmt.Errorf("ReadFile() error\n%+v", err)
	}

	return string(data), nil
}

func (a *App) SaveNote(noteId string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	n := fs.NoteTextFile(noteId)
	fp, err := a.current.Open(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write([]byte(data))
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (a *App) CreateHTML(id string, elm string) (string, error) {
	html, err := binder.CreateNoteHTML(a.current, id, elm)
	if err != nil {
		return "", fmt.Errorf("CreateNoteHTML() error\n%+v", err)
	}
	return html, nil
}

func (a *App) CreateData(id string, noteId string, name string) (*model.Datum, error) {
	if a.current == nil {
		return nil, fmt.Errorf("Not Open Binder")
	}

	//データを追加
	d, err := a.current.RegisterData(id, noteId, name)
	if err != nil {
		if errors.Is(err, db.DuplicateKey) {
			return nil, fmt.Errorf("Data Id[%s-%s] exists.", id, noteId)
		}
		return nil, fmt.Errorf("RegisterData error\n%+v", err)
	}

	return d, nil
}

func (a *App) OpenData(id, noteId string) (string, error) {

	if a.current == nil {
		return "", fmt.Errorf("Not Open Binder")
	}

	n := fs.DataTextFile(id, noteId)
	data, err := stdFs.ReadFile(a.current, n)
	if err != nil {
		return "", fmt.Errorf("ReadFile() error\n%+v", err)
	}

	return string(data), nil
}

func (a *App) SaveData(id, noteId string, data string) error {

	if a.current == nil {
		return fmt.Errorf("Not Open Binder")
	}

	n := fs.DataTextFile(id, noteId)
	fp, err := a.current.Open(n)
	if err != nil {
		return fmt.Errorf("Open() error\n%+v", err)
	}
	defer fp.Close()

	_, err = fp.(io.Writer).Write([]byte(data))
	if err != nil {
		return fmt.Errorf("Write() error\n%+v", err)
	}
	return nil
}

func (a *App) Close() bool {

	//*
	selection, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Close",
		Message:       "Exit?",
		DefaultButton: "No",
	})

	if err != nil {
		log.Println(err)
		return false
	}

	if selection == "Yes" {
		//TODO 終了処理を行う
		a.current.Close()
		os.Exit(0)
	}

	return false
}

func (a *App) SelectFile(name string, ptn string) (string, error) {

	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: name,
				Pattern:     ptn,
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("SelectFile() error\n%+v", err)
	}
	return selection, nil
}
