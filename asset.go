package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"bytes"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

func (b *Binder) EditAsset(a *json.Asset, f string) (*json.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	var data []byte
	var err error
	//ファイル指定がある場合
	if f != "" {

		data, err = os.ReadFile(f)
		if err != nil {
			return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
		}

		buf := bytes.NewBuffer(data)
		a.Binary = (fs.IsText(buf) == 0)

		fn := filepath.Base(f)
		//指定がない状態だった場合、ファイル名で設定しておく
		if a.Id == "" {
			a.Name = fn
			a.Alias = fn
		}
	}

	_, err = b.editAsset(a, data)
	if err != nil {
		return nil, xerrors.Errorf("editAsset() error: %w", err)
	}

	return a, nil
}

// DropAsset はフロントエンドからのファイルドロップでアセットを登録する。
// filename はドロップされたファイル名、base64data はファイル内容の base64 文字列。
func (b *Binder) DropAsset(a *json.Asset, filename string, base64data string) (*json.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	var data []byte
	if base64data != "" {
		var err error
		data, err = base64.StdEncoding.DecodeString(base64data)
		if err != nil {
			return nil, xerrors.Errorf("base64.DecodeString() error: %w", err)
		}

		buf := bytes.NewBuffer(data)
		a.Binary = (fs.IsText(buf) == 0)

		// 新規アセットの場合はファイル名で名前・エイリアスを設定
		if a.Id == "" {
			a.Name = filename
			a.Alias = filename
		}
	}

	_, err := b.editAsset(a, data)
	if err != nil {
		return nil, xerrors.Errorf("editAsset() error: %w", err)
	}

	return a, nil
}

func (b *Binder) editAsset(a *json.Asset, data []byte) (*json.Asset, error) {

	var prefix string
	var files []string

	//新規指定だった場合
	if a.Id == "" {

		a.Id = b.generateId()

		m := model.ConvertAsset(a)

		err := b.db.InsertAsset(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertAsset() error: %w", err)
		}

		// Structure作成（ParentIdはフロントから渡される）
		err = b.createStructure(a.Id, a.ParentId, "asset", a.Name, a.Detail, a.Alias)
		if err != nil {
			return nil, xerrors.Errorf("createStructure() error: %w", err)
		}

		prefix = "Created Asset"

	} else {

		m := model.ConvertAsset(a)

		err := b.db.UpdateAsset(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateAsset() error: %w", err)
		}

		// Structure更新
		err = b.updateStructure(a.Id, a.ParentId, a.Name, a.Detail, a.Alias)
		if err != nil {
			return nil, xerrors.Errorf("updateStructure() error: %w", err)
		}

		prefix = "Updated Asset"
	}

	// データ指定がある場合
	if data != nil {
		fn, err := b.fileSystem.CreateAsset(a, data)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateAsset() error: %w", err)
		}
		files = append(files, fn)
	}

	//データベースコミット
	files = append(files, fs.AssetTableFile(), fs.StructureTableFile())
	err := b.fileSystem.Commit(fs.M(prefix, a.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("fs.Commit() error: %w", err)
	}

	return a, nil
}

func (b *Binder) GetAsset(id string) (*json.Asset, error) {
	if b == nil {
		return nil, EmptyError
	}

	a, err := b.db.GetAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}

	m := a.To()

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}
	m.ApplyStructure(s.To())

	err = b.fileSystem.SetAssetStatus(m)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetAssetStatus() error: %w", err)
	}

	return m, nil
}

func (b *Binder) GetAssetWithParent(id string) (*json.Asset, error) {
	if b == nil {
		return nil, EmptyError
	}
	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAssetWithParent() error: %w", err)
	}
	return a, nil
}

func (b *Binder) RemoveAsset(id string) (*json.Asset, error) {

	if b == nil {
		return nil, EmptyError
	}

	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}

	//DBから削除
	err = b.db.DeleteAsset(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteAsset() error: %w", err)
	}

	err = b.db.DeleteStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteStructure() error: %w", err)
	}

	//ファイルを削除
	files, err := b.fileSystem.DeleteAsset(a)
	if err != nil {
		return nil, xerrors.Errorf("fs.RemoveAsset() error: %w", err)
	}

	files = append(files, fs.AssetTableFile(), fs.StructureTableFile())

	err = b.fileSystem.Commit(fs.M("Remove Asset", a.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return a, nil
}

func (b *Binder) PublishAsset(id string) (*json.Asset, error) {

	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAsset() error: %w", err)
	}

	fn, err := b.fileSystem.PublishAsset(a)
	if err != nil {
		return nil, xerrors.Errorf("fs.PublishAsset() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Publish Asset", a.Name), fn)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return a, nil
}

func (b *Binder) UnpublishAsset(id string) error {

	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return xerrors.Errorf("db.GetAsset() error: %w", err)
	}

	fn, err := b.fileSystem.UnpublishAsset(a)
	if err != nil {
		return xerrors.Errorf("fs.UnpublishAsset() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Unpublish Asset", a.Name), fn)
	if err != nil && !errors.Is(err, fs.UpdatedFilesError) {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (b *Binder) GetUnpublishedAssets() ([]*json.Asset, error) {

	all, err := b.db.FindAssetWithParent()
	if err != nil {
		return nil, xerrors.Errorf("db.FindAssetWithParent() error: %w", err)
	}

	pr := make([]*json.Asset, 0, len(all))

	for _, a := range all {

		err = b.fileSystem.SetAssetStatus(a)
		if err != nil {
			return nil, xerrors.Errorf("fs.SetAssetStatus() error: %w", err)
		}
		//最新じゃない場合は追加
		if a.PublishStatus != json.LatestStatus {
			pr = append(pr, a)
		}
	}
	return pr, nil
}

// MigrateAssetToNote はテキストアセットをノートに移行する。
// アセットの内容をノートのMarkdownとして登録し、元のアセットを削除する。
func (b *Binder) MigrateAssetToNote(assetId string) (*json.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	// アセット情報を取得
	a, err := b.db.GetAssetWithParent(assetId)
	if err != nil {
		return nil, xerrors.Errorf("db.GetAssetWithParent() error: %w", err)
	}

	// バイナリアセットは移行不可
	if a.Binary {
		return nil, xerrors.Errorf("cannot migrate binary asset to note: %s", a.Name)
	}

	// アセットの内容を読み込む
	data, _, err := b.ReadAssetBytes(assetId)
	if err != nil {
		return nil, xerrors.Errorf("ReadAssetBytes() error: %w", err)
	}

	// 新規ノートを作成
	n := &json.Note{
		Name:     a.Name,
		ParentId: a.ParentId,
	}
	n.Id = b.generateId()
	// エイリアスは元アセットのエイリアスから拡張子を除いたものを使用
	n.Alias = strings.TrimSuffix(a.Alias, filepath.Ext(a.Alias))

	// デフォルトレイアウトテンプレートを設定
	lt, err := b.db.FindDefaultLayoutTemplate()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDefaultLayoutTemplate() error: %w", err)
	}
	if lt != nil {
		n.LayoutTemplate = lt.Id
	}

	// デフォルトコンテンツテンプレートを設定
	dt, err := b.db.FindDefaultContentTemplate()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDefaultContentTemplate() error: %w", err)
	}
	if dt != nil {
		n.ContentTemplate = dt.Id
	}

	// ノートを作成してDBに登録
	fn, err := b.createNote(n)
	if err != nil {
		return nil, xerrors.Errorf("createNote() error: %w", err)
	}

	// アセット内容をノートファイルに書き込む
	err = b.fileSystem.WriteNoteText(n.Id, data)
	if err != nil {
		return nil, xerrors.Errorf("WriteNoteText() error: %w", err)
	}

	// Structure作成
	err = b.createStructure(n.Id, n.ParentId, "note", n.Name, n.Detail, n.Alias)
	if err != nil {
		return nil, xerrors.Errorf("createStructure() error: %w", err)
	}

	// アセットをDBから削除
	err = b.db.DeleteAsset(assetId)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteAsset() error: %w", err)
	}
	err = b.db.DeleteStructure(assetId)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteStructure() error: %w", err)
	}

	// アセットファイルを削除
	assetFiles, err := b.fileSystem.DeleteAsset(a)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteAsset() error: %w", err)
	}

	// 全変更をコミット
	files := []string{fn}
	files = append(files, assetFiles...)
	files = append(files, fs.NoteTableFile(), fs.AssetTableFile(), fs.StructureTableFile())
	err = b.fileSystem.Commit(fs.M("Migrate Asset to Note", n.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return n, nil
}

func (b *Binder) AssetFile(id string) string {
	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return ""
	}
	return fs.AssetFile(a)
}

// ReadAssetBytes はアセットファイルの内容をバイト列で返す。
// メタデータ（名前・バイナリフラグ）も合わせて返す。
func (b *Binder) ReadAssetBytes(id string) ([]byte, *json.Asset, error) {
	if b == nil {
		return nil, nil, EmptyError
	}
	a, err := b.db.GetAssetWithParent(id)
	if err != nil {
		return nil, nil, xerrors.Errorf("db.GetAssetWithParent() error: %w", err)
	}

	fn := fs.AssetFile(a)
	f, err := b.fileSystem.Open(fn)
	if err != nil {
		return nil, nil, xerrors.Errorf("Open() error: %w", err)
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return nil, nil, xerrors.Errorf("io.ReadAll() error: %w", err)
	}

	return data, a, nil
}
