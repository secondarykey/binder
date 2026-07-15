package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"

	"errors"
	"fmt"

	"golang.org/x/xerrors"
)

// DoctorReport は RunDoctor が行った修復の内容。
type DoctorReport struct {
	// OrphanRestored は実体ファイルはあるが structure 行が無かったもの（行を復元）
	OrphanRestored []fs.RestoredEntity
	// FilesRecreated は structure 行はあるが実体ファイルが無かったもの（空ファイルを再作成）
	FilesRecreated []fs.RestoredEntity
	// RowsRestored は structure 行はあるが実体テーブル行が無かったもの（最小行を復元）
	RowsRestored []fs.RestoredEntity
	// Reparented は親が存在しなかった structure 行の ID（index 直下へ移動）
	Reparented []string
}

// Repaired は何らかの修復を行った場合に true を返す。
func (r *DoctorReport) Repaired() bool {
	if r == nil {
		return false
	}
	return len(r.OrphanRestored)+len(r.FilesRecreated)+len(r.RowsRestored)+len(r.Reparented) > 0
}

// Summary はログ向けの1行要約を返す。
func (r *DoctorReport) Summary() string {
	if r == nil {
		return ""
	}
	return fmt.Sprintf("orphan rows=%d, recreated files=%d, entity rows=%d, reparented=%d",
		len(r.OrphanRestored), len(r.FilesRecreated), len(r.RowsRestored), len(r.Reparented))
}

// RunDoctor はバインダー内の整合性（structures ↔ 実体テーブル ↔ 実体ファイル）を
// 検査し、修復する。Load() から呼ばれるが、単体でも実行できる。
//
// 変更操作は「ファイル書き込み → DB(CSV)更新 → gitコミット」の多段構成のため、
// 途中でのクラッシュ・電源断・gitインデックス破損などで以下のズレが起こりうる:
//
//  1. structure 行はあるが実体ファイルが無い
//     → 開けず・削除もできない（Delete系はファイル欠損でエラー）詰み状態になるため、
//     空の実体ファイルを再作成して操作可能に戻す（内容は失われているので復元しない）
//  2. structure 行はあるが実体テーブル行が無い
//     → 最小メタデータで行を復元する
//  3. 実体ファイルはあるが structure 行が無い（orphan）
//     → ツリーから不可視のため、行を復元して index 直下へ復帰させる
//     （マージ後の ReconcileMergedTree と同じ処理を共用）
//  4. structure 行の親が存在しない（dangling parent）または自己参照
//     → ツリーから不可視のため、index 直下へ付け替える
//
// 修復した場合はシステム署名でコミットする。修復が無ければ何も書き込まない。
func (b *Binder) RunDoctor() (*DoctorReport, error) {

	if b == nil {
		return nil, EmptyError
	}

	rep := &DoctorReport{}
	changedTables := make(map[string]bool)
	structureChanged := false
	var newFiles []string

	structures, err := b.db.FindStructures()
	if err != nil {
		return nil, xerrors.Errorf("db.FindStructures() error: %w", err)
	}
	known := make(map[string]bool, len(structures))
	for _, s := range structures {
		known[s.Id] = true
	}

	// 実体テーブルの ID 集合
	rows, err := b.entityRowIds()
	if err != nil {
		return nil, err
	}

	// 1. structure 行の検査（実体テーブル行・実体ファイル・親の存在）
	for _, s := range structures {

		var fileFn, tableFn, defaultContent string

		switch s.Typ {
		case "note":
			fileFn, tableFn = fs.NoteFile(s.Id), fs.NoteTableFile()
		case "diagram":
			fileFn, tableFn = fs.DiagramFile(s.Id), fs.DiagramTableFile()
		case "layer":
			fileFn, tableFn = fs.LayerFile(s.Id), fs.LayerTableFile()
			// 空文字は JSON として不正なため最低限のオブジェクトを書く
			defaultContent = "{}"
		case "asset":
			fileFn, tableFn = fs.AssetFile(&json.Asset{Id: s.Id}), fs.AssetTableFile()
		default:
			// 未知タイプの行は触らない
			continue
		}

		// 実体ファイルが無ければ空で再作成する（開く・削除するを可能に戻す）
		if _, err := b.fileSystem.Stat(fileFn); err != nil {
			if err := b.recreateFile(fileFn, defaultContent); err != nil {
				return rep, xerrors.Errorf("recreateFile(%s) error: %w", fileFn, err)
			}
			newFiles = append(newFiles, fileFn)
			rep.FilesRecreated = append(rep.FilesRecreated, fs.RestoredEntity{Id: s.Id, Typ: s.Typ, Name: s.Name})
		}

		// 実体テーブル行が無ければ最小メタデータで復元する
		if !rows[s.Typ][s.Id] {
			if err := b.restoreEntityRow(s.Typ, s.Id); err != nil {
				return rep, err
			}
			changedTables[tableFn] = true
			rep.RowsRestored = append(rep.RowsRestored, fs.RestoredEntity{Id: s.Id, Typ: s.Typ, Name: s.Name})
		}

		// 親が存在しない・自己参照の場合は index 直下へ付け替える
		// （ルートの index 行は ParentId="" のため対象外）
		if s.ParentId != "" && (!known[s.ParentId] || s.ParentId == s.Id) {
			s.ParentId = "index"
			if err := b.db.UpdateStructure(s, b.op); err != nil {
				return rep, xerrors.Errorf("UpdateStructure(%s) error: %w", s.Id, err)
			}
			structureChanged = true
			rep.Reparented = append(rep.Reparented, s.Id)
		}
	}

	// 2. structure 行を持たない実体ファイル（orphan）の行復元
	restored, changed, err := b.restoreOrphanEntities()
	if err != nil {
		return rep, err
	}
	rep.OrphanRestored = restored
	for f := range changed {
		changedTables[f] = true
	}
	if len(restored) > 0 {
		structureChanged = true
	}

	if !rep.Repaired() {
		return rep, nil
	}

	// 修復内容をシステム署名でコミット
	files := newFiles
	if structureChanged {
		files = append(files, fs.StructureTableFile())
	}
	for f := range changedTables {
		files = append(files, f)
	}
	if err := b.fileSystem.AutoCommit(fs.M("Doctor", "repair consistency"), files...); err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return rep, xerrors.Errorf("AutoCommit() error: %w", err)
		}
	}

	return rep, nil
}

// entityRowIds は実体テーブルごとの ID 集合を typ 名をキーに返す。
func (b *Binder) entityRowIds() (map[string]map[string]bool, error) {

	rows := map[string]map[string]bool{
		"note":    {},
		"diagram": {},
		"layer":   {},
		"asset":   {},
	}

	notes, err := b.db.FindNotes()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}
	for _, m := range notes {
		rows["note"][m.Id] = true
	}

	diagrams, err := b.db.FindDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}
	for _, m := range diagrams {
		rows["diagram"][m.Id] = true
	}

	layers, err := b.db.FindLayers()
	if err != nil {
		return nil, xerrors.Errorf("db.FindLayers() error: %w", err)
	}
	for _, m := range layers {
		rows["layer"][m.Id] = true
	}

	assets, err := b.db.FindAssets()
	if err != nil {
		return nil, xerrors.Errorf("db.FindAssets() error: %w", err)
	}
	for _, m := range assets {
		rows["asset"][m.Id] = true
	}

	return rows, nil
}

// recreateFile は欠損した実体ファイルを content の内容で作成する（git add 込み）。
func (b *Binder) recreateFile(fn, content string) error {
	fp, err := b.fileSystem.Create(fn)
	if err != nil {
		return xerrors.Errorf("fs.Create() error: %w", err)
	}
	defer fp.Close()
	if content != "" {
		if _, err := fp.Write([]byte(content)); err != nil {
			return xerrors.Errorf("Write() error: %w", err)
		}
	}
	return nil
}

// restoreEntityRow は typ に応じた実体テーブル行を最小メタデータで復元する。
func (b *Binder) restoreEntityRow(typ, id string) error {

	switch typ {
	case "note":
		layout, content := b.defaultNoteTemplates()
		m := &model.Note{Id: id, LayoutTemplate: layout, ContentTemplate: content}
		if err := ignoreDup(b.db.InsertNote(m, b.op)); err != nil {
			return xerrors.Errorf("InsertNote(%s) error: %w", id, err)
		}
	case "diagram":
		if err := ignoreDup(b.db.InsertDiagram(&model.Diagram{Id: id}, b.op)); err != nil {
			return xerrors.Errorf("InsertDiagram(%s) error: %w", id, err)
		}
	case "layer":
		if err := ignoreDup(b.db.InsertLayer(&model.Layer{Id: id}, b.op)); err != nil {
			return xerrors.Errorf("InsertLayer(%s) error: %w", id, err)
		}
	case "asset":
		binary := b.detectAssetBinary(id)
		m := &model.Asset{Id: id, Binary: binary, Mime: detectMime(id, binary)}
		if err := ignoreDup(b.db.InsertAsset(m, b.op)); err != nil {
			return xerrors.Errorf("InsertAsset(%s) error: %w", id, err)
		}
	}
	return nil
}
