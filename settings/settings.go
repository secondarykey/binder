package settings

import (
	"encoding/json"
	"log"
	"os"
	"os/user"
	"path/filepath"
	"runtime"

	"golang.org/x/xerrors"
)

const (
	DirName          = ".binder"
	SettingsFileName = "setting.json"
	SnippetsFileName = "snippets.json"
)

type Setting struct {
	Position *Position `json:"position"`
	Path     *Path     `json:"path"`
	Look     *Look     `json:"lookAndFeel"`
	Git      *Git      `json:"git"`
	Language string    `json:"language"`
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
	Branch     string `json:"branch"`
	WorkBranch string `json:"workBranch"`
	Name       string `json:"name"`
	Mail       string `json:"mail"`
	Code       string `json:"code"`
	File       string `json:"file"`
}

type Look struct {
	DarkMode    bool    `json:"darkMode"`
	Theme       string  `json:"theme"`
	WholeText   *Font   `json:"whole"`
	TreeNoteNum int     `json:"treeNoteNum"`
	Editor      *Editor `json:"editor"`
}

type Editor struct {
	Program         string       `json:"program"`
	GitBash         bool         `json:"gitbash"`
	ShowLineNumbers bool         `json:"showLineNumbers"`
	WordWrap        bool         `json:"wordWrap"`
	ShowPreview     bool         `json:"showPreview"`
	ThemeFonts      []*ThemeFont `json:"themeFont"`
}

type ThemeFont struct {
	Theme string `json:"theme"`
	Font  *Font
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
	if pSet.Look.Editor == nil {
		ds := def()
		pSet.Look.Editor = ds.Look.Editor
	} else if !pSet.Look.Editor.ShowLineNumbers && !pSet.Look.Editor.WordWrap && !pSet.Look.Editor.ShowPreview {
		// 旧設定ファイルにはこれらのフィールドがないため、すべてfalseの場合はデフォルト値を適用
		pSet.Look.Editor.ShowLineNumbers = true
		pSet.Look.Editor.WordWrap = true
		pSet.Look.Editor.ShowPreview = true
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

	var darkf Font

	darkf.Name = "Arial"
	darkf.Size = 16
	darkf.Color = "#cccccc"
	darkf.BackgroundColor = "#333333"

	var lightf Font
	lightf.Name = "Arial"
	lightf.Size = 16
	lightf.Color = "#eeeeee"
	lightf.BackgroundColor = "#111111"

	var dtf ThemeFont
	dtf.Theme = "dark"
	dtf.Font = &darkf

	var ltf ThemeFont
	ltf.Theme = "light"
	ltf.Font = &lightf

	var editor Editor
	editor.ShowLineNumbers = true
	editor.WordWrap = true
	editor.ShowPreview = true
	editor.ThemeFonts = append(editor.ThemeFonts, &dtf, &ltf)

	look.Editor = &editor
	set.Look = &look

	//Git設定
	var auth Git
	auth.Branch = "main"

	host, err := os.Hostname()
	if err != nil {
		log.Println(err)
		host = "binder"
	}
	auth.WorkBranch = host

	// os/user からユーザ名を取得
	u, err := user.Current()
	if err != nil {
		log.Println(err)
		auth.Name = ""
	} else {
		auth.Name = u.Name
		if auth.Name == "" {
			auth.Name = u.Username
		}
	}

	auth.Mail = "noreply@localhost"
	auth.Code = ""
	auth.File = ""
	set.Git = &auth

	return &set
}

func GetFont() *Font {
	obj := Get()
	tfs := obj.Look.Editor.ThemeFonts
	for _, tf := range tfs {
		if tf.Theme == obj.Look.Theme {
			return tf.Font
		}
	}
	return nil
}

func SaveFont(f *Font) error {
	obj := Get()
	tfs := obj.Look.Editor.ThemeFonts
	for _, tf := range tfs {
		if tf.Theme == obj.Look.Theme {
			tf.Font = f
		}
	}
	return obj.save()
}

func GetPath() *Path {
	obj := Get()
	return obj.Path
}

func SaveBasePath(p *Path) error {

	obj := Get()

	obj.Path.Default = p.Default
	obj.Path.RunWithOpen = p.RunWithOpen
	obj.Path.OpenWithItem = p.OpenWithItem

	return obj.save()
}

func GetHistories() []string {
	obj := Get()
	return obj.Path.Histories
}

func SaveHistory(h string) error {
	obj := Get()
	list := []string{h}
	for _, v := range obj.Path.Histories {
		if h != v {
			list = append(list, v)
		}
	}
	obj.Path.Histories = list
	return obj.save()
}

func SaveLanguage(lang string) error {
	obj := Get()
	obj.Language = lang
	return obj.save()
}

func GetEditor() *Editor {
	obj := Get()
	return obj.Look.Editor
}

func SaveEditor(e *Editor) error {
	obj := Get()
	obj.Look.Editor.Program = e.Program
	obj.Look.Editor.GitBash = e.GitBash
	obj.Look.Editor.ShowLineNumbers = e.ShowLineNumbers
	obj.Look.Editor.WordWrap = e.WordWrap
	obj.Look.Editor.ShowPreview = e.ShowPreview
	return obj.save()
}

func GetGit() *Git {
	obj := Get()
	return obj.Git
}

func SaveGit(g *Git) error {
	obj := Get()
	obj.Git.Branch = g.Branch
	obj.Git.WorkBranch = g.WorkBranch
	obj.Git.Name = g.Name
	obj.Git.Mail = g.Mail
	return obj.save()
}

func SaveTheme(theme string) error {
	obj := Get()
	obj.Look.Theme = theme
	return obj.save()
}

func SavePosition(pos *Position) error {
	obj := Get()
	obj.Position = pos
	return obj.save()
}

func (s *Setting) save() error {

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

func DirPath() string {
	return filepath.Join(Home(), DirName)
}

func getFilePath() string {
	return filepath.Join(DirPath(), SettingsFileName)
}

func Home() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("USERPROFILE")
	}
	return os.Getenv("HOME")
}
