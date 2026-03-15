package settings

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"golang.org/x/xerrors"
)

type Setting struct {
	Position *Position `json:"position"`
	Path     *Path     `json:"path"`
	Look     *Look     `json:"lookAndFeel"`
	Git      *Git      `json:"git"`
}

func (s Setting) IsDefault() bool {
	if s.Position.Left == -9999 && s.Position.Top == -9999 {
		return true
	}
	return false
}

type Position struct {
	Top       int `json:"top"`
	Left      int `json:"left"`
	Width     int `json:"width"`
	Height    int `json:"height"`
	MenuWidth int `json:"menuWidth"`
	Splitter  int `json:"splitter"`
}

type Path struct {
	Default      string   `json:"default"`
	RunWithOpen  bool     `json:"runWithOpen"`
	OpenWithItem bool     `json:"openWithItem"`
	Histories    []string `json:"histories"`
	LastNoteId   string   `json:"lastNoteId"`
	LastDataId   string   `json:"lastDataId"`
}

func (p *Path) AddHistory(h string) {

	newHis := make([]string, 0, 10)
	newHis = append(newHis, h)

	for _, v := range p.Histories {
		if v != h {
			newHis = append(newHis, v)
		}
		if len(newHis) >= 10 {
			break
		}
	}
	p.Histories = newHis
}

type Git struct {
	Branch string `json:"branch"`
	Name   string `json:"name"`
	Mail   string `json:"mail"`
	Code   string `json:"code"`
	File   string `json;"file"`
}

type Look struct {
	DarkMode    bool    `json:"darkMode"`
	Theme       string  `json:"theme"`
	WholeText   *Font   `json:"whole"`
	TreeNoteNum int     `json:"treeNoteNum"`
	Editor      *Editor `json:"editor"`
}

type Editor struct {
	Program string `json:"program"`
	GitBash bool   `json: "gitbash"`
	Text    *Font  `json:"text"`
}

type Font struct {
	Name            string `json:"name"`
	Color           string `json:"color"`
	BackgroundColor string `json:"backgroundColor"`
	Size            int    `json:"size"`
}

type Vim struct {
	Use      bool `json:"use"`
	OpenWith bool `json:"openWith"`
}

var pSet *Setting

func Get() *Setting {
	var err error
	if pSet == nil {
		pSet, err = load()
		if err != nil {
			pSet = def()
		}
	}

	if pSet.Look == nil {
		ds := def()
		pSet.Look = ds.Look
	}
	return pSet
}

func def() *Setting {

	var set Setting
	//位置
	var pos Position
	pos.Left = -9999
	pos.Top = -9999
	pos.Width = 1280
	pos.Height = 768
	pos.MenuWidth = 320
	pos.Splitter = 400

	set.Position = &pos
	//デフォルトのパス
	var path Path
	p := "."
	exe, err := os.Executable()
	if err == nil {
		p = filepath.Dir(exe)
	}
	//新規作成時などのデフォルトパス
	path.Default = p
	//開いた履歴
	path.Histories = make([]string, 0)
	//起動と同時に最終バインダーを開く
	path.RunWithOpen = true
	//起動と同時に最終アイテムを開く
	path.OpenWithItem = false

	set.Path = &path
	//最後に開いていたバインダーを開く

	var look Look
	look.DarkMode = true
	look.Theme = "dark"
	var editor Editor
	var ef Font

	ef.Name = "Araial"
	ef.Size = 16
	ef.Color = "#000000"
	ef.BackgroundColor = "#FFFFFF"

	editor.Text = &ef
	look.Editor = &editor
	set.Look = &look

	//表示情報
	var auth Git
	host, err := os.Hostname()
	if err != nil {
		log.Println(err)
		host = "binder"
	}

	auth.Branch = host
	auth.Name = ""
	auth.Mail = ""
	auth.Code = ""
	//auth.File = "D:\\Program Files\\Git\\mingw64\\etc\\ssl\\certs\\ca-bundle.crt"
	auth.File = ""
	//認証情報
	set.Git = &auth

	return &set
}

func (s *Setting) Save() error {

	fn := getFilePath()
	fp, err := os.Create(fn)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer fp.Close()

	data, err := json.Marshal(s)
	if err != nil {
		return xerrors.Errorf("json.Marshal() error: %w", err)
	}
	_, err = fp.Write(data)
	if err != nil {
		return xerrors.Errorf("fp.Write() error: %w", err)
	}

	pSet = s
	return nil
}

func load() (*Setting, error) {

	fn := getFilePath()
	if _, err := os.Stat(fn); err != nil {
		return def(), nil
	}

	data, err := os.ReadFile(fn)
	if err != nil {
		return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
	}

	var obj Setting
	err = json.Unmarshal(data, &obj)
	if err != nil {
		return nil, xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return &obj, nil
}

func getFilePath() string {
	return filepath.Join(Home(), ".binder", "setting.json")
}

func Home() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("USERPROFILE")
	}
	return os.Getenv("HOME")
}
