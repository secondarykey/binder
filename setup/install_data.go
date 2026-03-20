package setup

import (
	jsonenc "encoding/json"

	"golang.org/x/xerrors"
)

const installDir = "_assets/install"

// InstallManifest はインストール時に作成するデータの一覧を定義する。
// _assets/install/manifest.json から読み込む。
type InstallManifest struct {
	Templates []InstallTemplate `json:"templates"`
	Notes     []InstallNote     `json:"notes"`
	Diagrams  []InstallDiagram  `json:"diagrams"`
	Assets    []InstallAsset    `json:"assets"`
}

type InstallTemplate struct {
	Id   string `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
	File string `json:"file"`
}

type InstallNote struct {
	Id              string `json:"id"`
	Alias           string `json:"alias"`
	Name            string `json:"name"`
	ParentId        string `json:"parentId"`
	LayoutTemplate  string `json:"layoutTemplate"`
	ContentTemplate string `json:"contentTemplate"`
	File            string `json:"file"`
}

type InstallDiagram struct {
	Name     string `json:"name"`
	ParentId string `json:"parentId"`
	File     string `json:"file"`
}

type InstallAsset struct {
	Name     string `json:"name"`
	Alias    string `json:"alias"`
	ParentId string `json:"parentId"`
	File     string `json:"file"`
}

// LoadInstallManifest は _assets/install/manifest.json を読み込んで返す。
func LoadInstallManifest() (*InstallManifest, error) {
	data, err := embFs.ReadFile(installDir + "/manifest.json")
	if err != nil {
		return nil, xerrors.Errorf("embFs.ReadFile(manifest.json) error: %w", err)
	}
	var m InstallManifest
	if err := jsonenc.Unmarshal(data, &m); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal(manifest.json) error: %w", err)
	}
	return &m, nil
}

// ReadFile は _assets/install/ 内のファイルを読み込む。
// file が空の場合は nil を返す。
func (m *InstallManifest) ReadFile(file string) ([]byte, error) {
	if file == "" {
		return nil, nil
	}
	data, err := embFs.ReadFile(installDir + "/" + file)
	if err != nil {
		return nil, xerrors.Errorf("embFs.ReadFile(%s) error: %w", file, err)
	}
	return data, nil
}
