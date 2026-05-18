package setup

import (
	jsonenc "encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"binder/log"
	"binder/settings"

	"golang.org/x/xerrors"
)

const installBaseDir = "_assets/install"

// installManifest はインストール時に作成するデータの一覧を定義する。
type installManifest struct {
	fsys    fs.FS
	baseDir string
	Templates []installTemplate `json:"templates"`
	Notes     []installNote     `json:"notes"`
	Diagrams  []installDiagram  `json:"diagrams"`
	Assets    []installAsset    `json:"assets"`
}

type installTemplate struct {
	Id   string `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
	File string `json:"file"`
}

type installNote struct {
	Id              string `json:"id"`
	Alias           string `json:"alias"`
	Name            string `json:"name"`
	ParentId        string `json:"parentId"`
	LayoutTemplate  string `json:"layoutTemplate"`
	ContentTemplate string `json:"contentTemplate"`
	File            string `json:"file"`
}

type installDiagram struct {
	Id            string `json:"id"`
	Name          string `json:"name"`
	ParentId      string `json:"parentId"`
	StyleTemplate string `json:"styleTemplate"`
	File          string `json:"file"`
}

type installAsset struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	Alias    string `json:"alias"`
	ParentId string `json:"parentId"`
	Binary   bool   `json:"binary"`
	Mime     string `json:"mime"`
	File     string `json:"file"`
}

// InstallPreset はインストール時に選択可能なプリセット情報。
type InstallPreset struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	BuiltIn     bool   `json:"builtIn"`
}

// loadInstallManifest は指定された installType のマニフェストを読み込む。
// 組み込みテンプレート（_assets/install/{type}/）を優先し、
// 見つからなければユーザーディレクトリ（~/.binder/install/{type}/）から読む。
func loadInstallManifest(installType string) (*installManifest, error) {
	if installType == "" {
		installType = InstallTypeSimple
	}

	// 組み込みから読む
	dir := installBaseDir + "/" + installType
	data, err := embFs.ReadFile(dir + "/manifest.json")
	if err == nil {
		m, merr := parseManifest(data, embFs, dir)
		if merr != nil {
			return nil, merr
		}
		m.validate(installType)
		return m, nil
	}

	// ユーザーディレクトリから読む
	userDir := filepath.Join(userInstallDir(), installType)
	osData, osErr := os.ReadFile(filepath.Join(userDir, "manifest.json"))
	if osErr != nil {
		return nil, xerrors.Errorf("manifest not found for type %q (embed: %w)", installType, err)
	}
	m, merr := parseManifest(osData, os.DirFS(userDir), ".")
	if merr != nil {
		return nil, merr
	}
	m.validate(installType)
	return m, nil
}

func parseManifest(data []byte, fsys fs.FS, baseDir string) (*installManifest, error) {
	var m installManifest
	if err := jsonenc.Unmarshal(data, &m); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal(manifest.json) error: %w", err)
	}
	m.fsys = fsys
	m.baseDir = baseDir
	return &m, nil
}

// readFile はマニフェストのベースディレクトリ内のファイルを読み込む。
// file が "shared/" プレフィックスの場合は共有ディレクトリから読む。
// file が空の場合は nil を返す。
func (m *installManifest) readFile(file string) ([]byte, error) {
	if file == "" {
		return nil, nil
	}
	var path string
	if strings.HasPrefix(file, "shared/") {
		path = installBaseDir + "/" + file
		data, err := embFs.ReadFile(path)
		if err != nil {
			return nil, xerrors.Errorf("embFs.ReadFile(%s) error: %w", file, err)
		}
		return data, nil
	}

	path = m.baseDir + "/" + file
	data, err := fs.ReadFile(m.fsys, path)
	if err != nil {
		return nil, xerrors.Errorf("ReadFile(%s) error: %w", file, err)
	}
	return data, nil
}

// validate はマニフェストの構成をチェックし、問題があれば warn ログを出力する。
func (m *installManifest) validate(installType string) {
	prefix := fmt.Sprintf("install preset %q: ", installType)

	// テンプレートIDの集合
	templateIds := make(map[string]bool)
	for _, t := range m.Templates {
		templateIds[t.Id] = true
	}

	// 全エンティティのIDを収集（parentId の参照先チェック用）
	knownIds := map[string]bool{"": true, "index": true}
	for _, n := range m.Notes {
		if n.Id != "" {
			knownIds[n.Id] = true
		}
	}
	for _, d := range m.Diagrams {
		if d.Id != "" {
			knownIds[d.Id] = true
		}
	}
	for _, a := range m.Assets {
		if a.Id != "" {
			knownIds[a.Id] = true
		}
	}

	// ID重複チェック
	allIds := make(map[string]string)
	checkDupId := func(id, entity string) {
		if id == "" || id == "index" {
			return
		}
		if prev, ok := allIds[id]; ok {
			log.Warn(prefix + fmt.Sprintf("duplicate id %q in %s and %s", id, prev, entity))
		}
		allIds[id] = entity
	}

	// テンプレートのファイル存在チェック
	for _, t := range m.Templates {
		if t.File != "" {
			m.warnIfFileMissing(prefix, t.File, "template "+t.Name)
		}
	}

	// ノートのバリデーション
	for _, n := range m.Notes {
		checkDupId(n.Id, "note "+n.Name)
		if n.ParentId != "" && !knownIds[n.ParentId] {
			log.Warn(prefix + fmt.Sprintf("note %q references unknown parentId %q", n.Name, n.ParentId))
		}
		if n.LayoutTemplate != "" && !templateIds[n.LayoutTemplate] {
			log.Warn(prefix + fmt.Sprintf("note %q references unknown layoutTemplate %q", n.Name, n.LayoutTemplate))
		}
		if n.ContentTemplate != "" && !templateIds[n.ContentTemplate] {
			log.Warn(prefix + fmt.Sprintf("note %q references unknown contentTemplate %q", n.Name, n.ContentTemplate))
		}
		if n.File != "" {
			m.warnIfFileMissing(prefix, n.File, "note "+n.Name)
		}
	}

	// ダイアグラムのバリデーション
	for _, d := range m.Diagrams {
		checkDupId(d.Id, "diagram "+d.Name)
		if d.ParentId != "" && !knownIds[d.ParentId] {
			log.Warn(prefix + fmt.Sprintf("diagram %q references unknown parentId %q", d.Name, d.ParentId))
		}
		if d.StyleTemplate != "" && !templateIds[d.StyleTemplate] {
			log.Warn(prefix + fmt.Sprintf("diagram %q references unknown styleTemplate %q", d.Name, d.StyleTemplate))
		}
		if d.File != "" {
			m.warnIfFileMissing(prefix, d.File, "diagram "+d.Name)
		}
	}

	// アセットのバリデーション
	for _, a := range m.Assets {
		checkDupId(a.Id, "asset "+a.Name)
		if a.ParentId != "" && !knownIds[a.ParentId] {
			log.Warn(prefix + fmt.Sprintf("asset %q references unknown parentId %q", a.Name, a.ParentId))
		}
		if a.Mime == "" {
			log.Warn(prefix + fmt.Sprintf("asset %q has no mime type", a.Name))
		}
		if a.File != "" {
			m.warnIfFileMissing(prefix, a.File, "asset "+a.Name)
		}
	}
}

func (m *installManifest) warnIfFileMissing(prefix, file, entity string) {
	_, err := m.readFile(file)
	if err != nil {
		log.Warn(prefix + fmt.Sprintf("%s references missing file %q", entity, file))
	}
}

// userInstallDir は ~/.binder/install のパスを返す。
func userInstallDir() string {
	return filepath.Join(settings.DirPath(), "install")
}

// GetInstallPresets は利用可能なインストールプリセット一覧を返す。
// 組み込みプリセット＋ユーザー定義プリセットを結合する。
func GetInstallPresets() []InstallPreset {
	presets := builtInPresets()

	// ユーザーディレクトリをスキャン
	dir := userInstallDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return presets
	}

	builtInIds := make(map[string]bool)
	for _, p := range presets {
		builtInIds[p.Id] = true
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		id := e.Name()
		if builtInIds[id] {
			continue
		}
		// manifest.json が存在するか確認
		manifestPath := filepath.Join(dir, id, "manifest.json")
		if _, err := os.Stat(manifestPath); err != nil {
			continue
		}
		preset := InstallPreset{
			Id:      id,
			Name:    id,
			BuiltIn: false,
		}
		// manifest に name/description があれば読む
		if data, err := os.ReadFile(manifestPath); err == nil {
			var meta struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			}
			if jsonenc.Unmarshal(data, &meta) == nil {
				if meta.Name != "" {
					preset.Name = meta.Name
				}
				if meta.Description != "" {
					preset.Description = meta.Description
				}
			}
		}
		presets = append(presets, preset)
	}

	return presets
}

func builtInPresets() []InstallPreset {
	return []InstallPreset{
		{Id: InstallTypeSimple, Name: "Simple", BuiltIn: true},
		{Id: InstallTypeDocument, Name: "Document", BuiltIn: true},
		{Id: InstallTypeBlog, Name: "Blog", BuiltIn: true},
	}
}
