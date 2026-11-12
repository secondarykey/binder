package fs

import (
	"golang.org/x/xerrors"
)

// DB の CSV ファイル名（db ディレクトリの下）。git に載せるパスを作るために fs が持つ。
// fs は db パッケージを import しない（層の図では並び）ので、db のテーブル名から作らずにここへ書く。
// db 側のファイル名（db.Tables()）と揃っていることは、ルートの table_files_test.go が確かめる。
// テーブルを足したら、ここと allTableFiles にも足す。
const (
	noteTableFileName      = "notes.csv"
	diagramTableFileName   = "diagrams.csv"
	assetTableFileName     = "assets.csv"
	layerTableFileName     = "layers.csv"
	templateTableFileName  = "templates.csv"
	structureTableFileName = "structures.csv"
)

func NoteTableFile() string {
	return tablePath(noteTableFileName)
}

func DiagramTableFile() string {
	return tablePath(diagramTableFileName)
}

func AssetTableFile() string {
	return tablePath(assetTableFileName)
}

func LayerTableFile() string {
	return tablePath(layerTableFileName)
}

func TemplateTableFile() string {
	return tablePath(templateTableFileName)
}

func StructureTableFile() string {
	return tablePath(structureTableFileName)
}

func tablePath(f string) string {
	//Git
	return DBDir + "/" + f
}

func (f *FileSystem) SchemaCommit(fn string) error {

	n := tablePath(fn)
	err := f.add(n)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}

	files := allTableFiles()
	files = append(files, n)

	err = f.Commit(M("Schema Evolution", "Database"), files...)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

// AllTableFiles は git に載せる DB の CSV ファイルのパスをすべて返す。
func AllTableFiles() []string {
	return allTableFiles()
}

func allTableFiles() []string {
	return []string{
		NoteTableFile(),
		DiagramTableFile(),
		AssetTableFile(),
		LayerTableFile(),
		TemplateTableFile(),
		StructureTableFile(),
	}
}

func (f *FileSystem) AddDBFiles() error {

	files := allTableFiles()

	err := f.add(files...)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}

// AddFile は指定したファイルをgitのインデックスに追加する
func (f *FileSystem) AddFile(name string) error {
	err := f.add(name)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}

// RemoveFile はファイルをgitのインデックスから削除する（削除のステージング）
// ファイルが追跡されていない場合はエラーを無視する
func (f *FileSystem) RemoveFile(name string) error {
	return f.remove(name)
}
