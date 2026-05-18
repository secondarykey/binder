package setup

import (
	jsonenc "encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

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
		return parseManifest(data, embFs, dir)
	}

	// ユーザーディレクトリから読む
	userDir := filepath.Join(userInstallDir(), installType)
	osData, osErr := os.ReadFile(filepath.Join(userDir, "manifest.json"))
	if osErr != nil {
		return nil, xerrors.Errorf("manifest not found for type %q (embed: %w)", installType, err)
	}
	return parseManifest(osData, os.DirFS(userDir), ".")
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
