package binder

import (
	"binder/api/json"
	"binder/db"
	"binder/db/model"
	"binder/fs"

	"errors"
	"strings"

	"golang.org/x/xerrors"
)

// ReconcileMergedTree はマージ適用後に、実体ファイルは存在するが structure 行が
// 失われた orphan エンティティを検出し、structure 行＋実体テーブル行を復元して
// ツリー（index 直下）へ復帰させる。
//
// 削除 vs 内容変更のコンフリクトで、ユーザーが内容ファイル側を残す選択をすると、
// structures.csv / 実体テーブルの行は削除に倒れる一方で内容ファイルだけが残り、
// ツリーから不可視（orphan）になる。「2ブランチの変更を壊さない」ため、それらを
// 破棄せず最小限のメタデータで復元し、ツリーに見える形で残す。
//
// 復元したエンティティの一覧を返す。orphan が無ければ空を返し、コミットも行わない。
// 復元結果はマージログノートへ記録するため呼び出し側で利用する。
func (b *Binder) ReconcileMergedTree() ([]fs.RestoredEntity, error) {

	if b == nil {
		return nil, EmptyError
	}

	// 既存の structure 行 ID 集合（orphan 判定用）
	structures, err := b.db.FindStructures()
	if err != nil {
		return nil, xerrors.Errorf("db.FindStructures() error: %w", err)
	}
	known := make(map[string]bool, len(structures))
	for _, s := range structures {
		known[s.Id] = true
	}

	var restored []fs.RestoredEntity
	changed := make(map[string]bool)

	// note: notes/<id>.md
	noteIds, err := b.orphanContentIds(fs.NoteDir, ".md", known)
	if err != nil {
		return nil, xerrors.Errorf("orphanContentIds(note) error: %w", err)
	}
	if len(noteIds) > 0 {
		layout, content := b.defaultNoteTemplates()
		for _, id := range noteIds {
			m := &model.Note{Id: id, LayoutTemplate: layout, ContentTemplate: content}
			if err := ignoreDup(b.db.InsertNote(m, b.op)); err != nil {
				return nil, xerrors.Errorf("InsertNote(%s) error: %w", id, err)
			}
			if err := b.createStructure(id, "index", "note", id, "", id); err != nil {
				return nil, xerrors.Errorf("createStructure(note %s) error: %w", id, err)
			}
			restored = append(restored, fs.RestoredEntity{Id: id, Typ: "note", Name: id})
			changed[fs.NoteTableFile()] = true
		}
	}

	// diagram: diagrams/<id>.md
	diagramIds, err := b.orphanContentIds(fs.DiagramDir, ".md", known)
	if err != nil {
		return nil, xerrors.Errorf("orphanContentIds(diagram) error: %w", err)
	}
	for _, id := range diagramIds {
		m := &model.Diagram{Id: id}
		if err := ignoreDup(b.db.InsertDiagram(m, b.op)); err != nil {
			return nil, xerrors.Errorf("InsertDiagram(%s) error: %w", id, err)
		}
		if err := b.createStructure(id, "index", "diagram", id, "", id); err != nil {
			return nil, xerrors.Errorf("createStructure(diagram %s) error: %w", id, err)
		}
		restored = append(restored, fs.RestoredEntity{Id: id, Typ: "diagram", Name: id})
		changed[fs.DiagramTableFile()] = true
	}

	// layer: layers/<id>.json
	layerIds, err := b.orphanContentIds(fs.LayerDir, ".json", known)
	if err != nil {
		return nil, xerrors.Errorf("orphanContentIds(layer) error: %w", err)
	}
	for _, id := range layerIds {
		m := &model.Layer{Id: id}
		if err := ignoreDup(b.db.InsertLayer(m, b.op)); err != nil {
			return nil, xerrors.Errorf("InsertLayer(%s) error: %w", id, err)
		}
		if err := b.createStructure(id, "index", "layer", id, "", id); err != nil {
			return nil, xerrors.Errorf("createStructure(layer %s) error: %w", id, err)
		}
		restored = append(restored, fs.RestoredEntity{Id: id, Typ: "layer", Name: id})
		changed[fs.LayerTableFile()] = true
	}

	// asset: assets/<id>（meta サブディレクトリは除外。ファイル名そのものが id）
	assetIds, err := b.orphanContentIds(fs.AssetDir, "", known)
	if err != nil {
		return nil, xerrors.Errorf("orphanContentIds(asset) error: %w", err)
	}
	for _, id := range assetIds {
		binary := b.detectAssetBinary(id)
		m := &model.Asset{Id: id, Binary: binary, Mime: detectMime(id, binary)}
		if err := ignoreDup(b.db.InsertAsset(m, b.op)); err != nil {
			return nil, xerrors.Errorf("InsertAsset(%s) error: %w", id, err)
		}
		if err := b.createStructure(id, "index", "asset", id, "", id); err != nil {
			return nil, xerrors.Errorf("createStructure(asset %s) error: %w", id, err)
		}
		restored = append(restored, fs.RestoredEntity{Id: id, Typ: "asset", Name: id})
		changed[fs.AssetTableFile()] = true
	}

	if len(restored) == 0 {
		return nil, nil
	}

	// 変更した実体テーブル + structures.csv をコミット（内容ファイルは
	// マージコミットで既にステージ済みのため対象に含めない）
	files := []string{fs.StructureTableFile()}
	for f := range changed {
		files = append(files, f)
	}
	if err := b.fileSystem.Commit(fs.M("Reconcile Merge", "restore orphan entities"), files...); err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return nil, xerrors.Errorf("Commit() error: %w", err)
		}
	}

	return restored, nil
}

// orphanContentIds は dir 直下のファイルのうち、ext を持ち（ext="" なら全ファイル）、
// structure 行が存在しない（known に無い）id 一覧を返す。サブディレクトリは無視する。
// id はファイル名から ext を除いた値。ディレクトリが存在しない場合は orphan 無し。
func (b *Binder) orphanContentIds(dir, ext string, known map[string]bool) ([]string, error) {
	entries, err := b.fileSystem.ReadDir(dir)
	if err != nil {
		// ディレクトリ未作成 = 該当エンティティ無し
		return nil, nil
	}

	var ids []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if ext != "" {
			if !strings.HasSuffix(name, ext) {
				continue
			}
			name = strings.TrimSuffix(name, ext)
		}
		if name == "" || known[name] {
			continue
		}
		ids = append(ids, name)
	}
	return ids, nil
}

// defaultNoteTemplates はノート復元時に設定するデフォルトのレイアウト/コンテンツ
// テンプレート ID を返す。取得失敗時は空文字（ユーザーが後から設定可能）。
func (b *Binder) defaultNoteTemplates() (layout, content string) {
	if lt, err := b.db.FindDefaultLayoutTemplate(); err == nil && lt != nil {
		layout = lt.Id
	}
	if dt, err := b.db.FindDefaultContentTemplate(); err == nil && dt != nil {
		content = dt.Id
	}
	return layout, content
}

// detectAssetBinary はアセットファイルの内容を読み、バイナリかどうかを判定する。
// 読めない場合は false（テキスト扱い）。
func (b *Binder) detectAssetBinary(id string) bool {
	f, err := b.fileSystem.Open(fs.AssetFile(&json.Asset{Id: id}))
	if err != nil {
		return false
	}
	defer f.Close()
	return fs.IsText(f) == 0
}

// ignoreDup は DuplicateKey エラーを無視する（実体行のみ既存のケース）。
func ignoreDup(err error) error {
	if err == nil || errors.Is(err, db.DuplicateKey) {
		return nil
	}
	return err
}
