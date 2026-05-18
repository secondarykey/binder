package setup

import (
	jsonenc "encoding/json"
	"strings"

	"golang.org/x/xerrors"
)

const installBaseDir = "_assets/install"

// installManifest はインストール時に作成するデータの一覧を定義する。
// _assets/install/{type}/manifest.json から読み込む。
type installManifest struct {
	baseDir   string
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
	File     string `json:"file"`
}

// loadInstallManifest は _assets/install/{installType}/manifest.json を読み込んで返す。
// installType が空の場合は "simple" をデフォルトとする。
func loadInstallManifest(installType string) (*installManifest, error) {
	if installType == "" {
		installType = InstallTypeSimple
	}
	dir := installBaseDir + "/" + installType
	data, err := embFs.ReadFile(dir + "/manifest.json")
	if err != nil {
		return nil, xerrors.Errorf("embFs.ReadFile(%s/manifest.json) error: %w", installType, err)
	}
	var m installManifest
	if err := jsonenc.Unmarshal(data, &m); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal(manifest.json) error: %w", err)
	}
	m.baseDir = dir
	return &m, nil
}

// readFile はマニフェストのベースディレクトリ内のファイルを読み込む。
// file が "shared/" プレフィックスの場合は _assets/install/shared/ から読む。
// file が空の場合は nil を返す。
func (m *installManifest) readFile(file string) ([]byte, error) {
	if file == "" {
		return nil, nil
	}
	var path string
	if strings.HasPrefix(file, "shared/") {
		path = installBaseDir + "/" + file
	} else {
		path = m.baseDir + "/" + file
	}
	data, err := embFs.ReadFile(path)
	if err != nil {
		return nil, xerrors.Errorf("embFs.ReadFile(%s) error: %w", file, err)
	}
	return data, nil
}
