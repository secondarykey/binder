package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"

	"golang.org/x/xerrors"
)

type Setting struct {
	Position       *Position       `json:"position"`
	Path           *Path           `json:"path"`
	Look           *Look           `json:"lookAndFeel"`
	Authentication *Authentication `json:"authentication"`
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
	RunWithOpen  bool     `json:"runWithOpen"`
	OpenWithItem bool     `json:"openWithItem"`
	Default      string   `json:"default"`
	Histories    []string `json:"histories"`
	LastNoteId   string   `json:"lastNoteId"`
	LastDataId   string   `json:"lastDataId"`
}

type Authentication struct {
	Name string `json:"name"`
	Mail string `json:"mail"`
	Code string `json:"code"`
}

type Look struct {
	DarkMode  bool    `json:"darkMode"`
	WholeText *Font   `json:"whole"`
	Editor    *Editor `json:"editor"`
}

type Editor struct {
	Text Font `json:"text"`
	Vim  Vim  `json:"vim"`
}

type Font struct {
	Name      string `json:"name"`
	Color     string `json:"color"`
	ForeColor string `json:"foreColor"`
	Size      int    `json:"size"`
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

	//表示情報
	var auth Authentication
	auth.Name = "Commit Name"
	auth.Mail = "Commit Email"
	auth.Code = "generate remote code"
	//認証情報
	set.Authentication = &auth

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
	return filepath.Join(Home(), ".binder.json")
}

func Home() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("USERPROFILE")
	}
	return os.Getenv("HOME")
}
