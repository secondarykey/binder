package convert

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	. "binder/internal"
	"binder/log"

	"binder/db"
	"binder/fs"
	dbconvert "binder/setup/convert/db"
	convert0102 "binder/setup/convert/db/0102"
	convert092 "binder/setup/convert/db/092"
	convert097 "binder/setup/convert/db/097"

	"golang.org/x/xerrors"
)

var v072, v092, v097, v0102 *Version

// migrationMu は convert.Run() の同時実行を直列化する。
// go-git の Worktree/index 操作はスレッドセーフではないため、同一バインダーを
// 並行して開いた場合（React StrictMode の二重マウント等で Convert が二重発火する等）に
// .git/index への並行アクセスが起き、Add 時に EOF（インデックスのデコード途中終了）が発生する。
// Run() 全体をロックで囲み、後続呼び出しは先行処理の完了後に実行する。
// 2回目以降は binder.json が更新済みのため、移行対象なしの実質no-opになる。
var migrationMu sync.Mutex

// migrateState は移行処理中の内部状態を保持する
type migrateState struct {
	gitignorCreated      bool
	diagramStyleMigrated bool
}

// migration はひとつのバージョン移行を表す。
// run がそのバージョンへの移行に必要な全処理（CSV変換＋FS移行）を担う。
type migration struct {
	ver *Version
	run func(dir, dbDir string, state *migrateState) error
}

// migrations はバージョン順に並べた移行リスト。
// Run() がこのリストを順番に走査し、ov より新しいバージョンの移行を適用する。
var migrations []migration

func init() {
	var err error

	v072, err = NewVersion("0.7.2")
	if err != nil {
		panic("v072 version parse error: " + err.Error())
	}
	v092, err = NewVersion("0.9.2")
	if err != nil {
		panic("v092 version parse error: " + err.Error())
	}
	v097, err = NewVersion("0.9.7")
	if err != nil {
		panic("v097 version parse error: " + err.Error())
	}
	v0102, err = NewVersion("0.10.2")
	if err != nil {
		panic("v0102 version parse error: " + err.Error())
	}
	migrations = []migration{
		// 0.7.2: .gitignore を作成（user_data.enc を除外）
		{v072, func(dir, _ string, state *migrateState) error {
			ignorePath := filepath.Join(dir, fs.GitIgnoreFile)
			if _, statErr := os.Stat(ignorePath); os.IsNotExist(statErr) {
				if err := os.WriteFile(ignorePath, []byte(fs.UserFileName+"\n"), 0644); err != nil {
					return xerrors.Errorf("os.WriteFile(.gitignore) error: %w", err)
				}
			}
			state.gitignorCreated = true
			return nil
		}},
		// 0.9.2: assets.csv に mime 列を追加（ファイル名の拡張子からMIMEタイプを判定）
		{v092, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert092.Convert092)
		}},
		// 0.9.7: structures.csv に private 列を追加（デフォルト値: false）
		// diagrams.csv に style_template 列を追加（デフォルト値: diagram_style）
		// templates.csv に diagram_style レコードを追加
		// templates/diagram_style.tmpl ファイルを作成（内容: {'theme':'base'}）
		{v097, func(dir, dbDir string, state *migrateState) error {
			if err := applyDB(dbDir, convert097.Convert097); err != nil {
				return err
			}
			// diagram_style テンプレートファイルを作成（冪等）
			tmplPath := filepath.Join(dir, fs.TemplateDir, "diagram_style.tmpl")
			if _, statErr := os.Stat(tmplPath); os.IsNotExist(statErr) {
				if err := os.MkdirAll(filepath.Dir(tmplPath), 0755); err != nil {
					return xerrors.Errorf("MkdirAll(templates) error: %w", err)
				}
				if err := os.WriteFile(tmplPath, []byte("{'theme':'base'}"), 0644); err != nil {
					return xerrors.Errorf("os.WriteFile(diagram_style.tmpl) error: %w", err)
				}
				state.diagramStyleMigrated = true
			}
			return nil
		}},
		// 0.10.2: layers.csv を新規テーブルとして追加（db.EnsureTableFiles で作成）
		{v0102, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert0102.Convert0102)
		}},
	}
}

// applyDB はひとつの CSV コンバーターを db ディレクトリに適用するヘルパー
func applyDB(dbDir string, c dbconvert.Converter) error {
	return dbconvert.Apply(dbDir, []dbconvert.Converter{c})
}

// MigrateResult は移行処理の結果を呼び出し元に返す。
type MigrateResult struct {
	// UserDataRequired は 0.7.2 移行が適用され、ユーザデータの初期作成が必要であることを示す。
	UserDataRequired bool
}

// MinRequiredAppVersion はバインダーを開くために必要な最低アプリバージョン。
// スキーマ変更・JSON設定移行・アプリの互換性に影響する変更があった際に手動で更新する。
const MinRequiredAppVersion = "0.10.2"

// MinSupportedBinderVersion はこのアプリが移行できる最小のバインダーバージョン。
// これ未満のバインダーは旧移行コードが削除済みのため移行できず、
// 旧バージョンのアプリで一度開いて移行する必要がある。
// 移行エントリを将来削除する際は、HISTORY.md に手法を記録したうえで
// この値を「削除後に残る最古の移行が前提とするバージョン」へ更新する。
const MinSupportedBinderVersion = "0.4.8"

// NeedsMigration は指定バージョンから現在のスキーマへの移行処理が必要かを返す。
// ov が全ての migration エントリより新しい（または同じ）場合は false を返す。
func NeedsMigration(ov *Version) bool {
	for _, m := range migrations {
		if ov.Lt(m.ver) {
			return true
		}
	}
	return false
}

// Run はバインダーレベルの全移行処理を実行する。
// binder.json を読み込んで現在のスキーマバージョンを取得し、必要な移行を順番に適用する。
// 移行後は binder.json を更新して保存し、git コミットまで完結させる。
// 各移行は CSV スキーマ変換とファイルシステム移行を含む自己完結した処理単位。
// 移行処理が失敗した場合は git reset --hard HEAD でワークツリーをロールバックする。
func Run(dir string, ver *Version) (result *MigrateResult, err error) {

	result = &MigrateResult{}

	if ver == nil {
		return result, nil
	}

	// go-git のインデックス操作はスレッドセーフではないため、Run() を直列化する。
	// 同一バインダーを並行して開いた際の .git/index 競合（Add 時の EOF）を防ぐ。
	migrationMu.Lock()
	defer migrationMu.Unlock()

	meta, err := loadMeta(dir)
	if err != nil {
		return nil, xerrors.Errorf("loadMeta() error: %w", err)
	}

	ov, err := NewVersion(meta.Version)
	if err != nil {
		return nil, xerrors.Errorf("NewVersion() error: %w", err)
	}

	// 最小サポートバージョン未満のバインダーは移行できない（旧移行コードは削除済み）。
	// 通常は CheckCompat（CompatBinderTooOld）で先に弾かれるが、
	// 移行をサイレントにスキップしてデータを壊さないよう、ここでも防衛する。
	minVer, err := NewVersion(MinSupportedBinderVersion)
	if err != nil {
		return nil, xerrors.Errorf("NewVersion(MinSupportedBinderVersion) error: %w", err)
	}
	if ov.Lt(minVer) {
		return nil, xerrors.Errorf("binder version %s is older than minimum supported %s: open it with an older app version to migrate first", ov.String(), MinSupportedBinderVersion)
	}

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("Load() error: %w", err)
	}

	// 移行前の固定点（ロールバック先）を記録する。
	origHead, err := bfs.HeadHash()
	if err != nil {
		return nil, xerrors.Errorf("HeadHash() error: %w", err)
	}
	rollbackTarget := origHead.String()

	// 未記録の作業（ノート/ダイアグラム本文・ルートファイル等）がある場合は、移行を始める前に
	// 安全用スナップショットとしてコミットしておく。go-git の reset --hard は追跡ファイルの
	// 未コミット変更を区別なく破棄するため、これをしないと移行失敗時のロールバックでユーザーの
	// 未記録作業まで消えてしまう。スナップショットへ戻すことで未記録作業を保全する。
	mods, err := bfs.Status()
	if err != nil {
		return nil, xerrors.Errorf("Status() error: %w", err)
	}
	if len(mods) > 0 {
		snapMsg := fmt.Sprintf("Pre-migration safety snapshot (%s)", ov.String())
		if cErr := bfs.CommitAll(fs.M(snapMsg, "Schema")); cErr != nil && !errors.Is(cErr, fs.UpdatedFilesError) {
			return nil, xerrors.Errorf("CommitAll(snapshot) error: %w", cErr)
		}
		snapHead, err := bfs.HeadHash()
		if err != nil {
			return nil, xerrors.Errorf("HeadHash(snapshot) error: %w", err)
		}
		rollbackTarget = snapHead.String()
	}

	// 移行処理が失敗した場合、ワークツリーを移行前の固定点にロールバックする。
	// HEAD ではなく記録した固定点へ戻すことで、部分的に成功した移行コミットへ着地せず、
	// かつ未記録作業を保全したスナップショットへ確実に戻す。
	// 中途半端に変更されたCSVや作成されたファイルを残さないことで、
	// ブランチ切替など後続の操作を安全に行えるようにする。
	defer func() {
		if err != nil {
			log.Warn("convert.Run: migration failed, restoring worktree to pre-migration snapshot")
			if resetErr := bfs.ResetHardTo(rollbackTarget); resetErr != nil {
				log.Warn("convert.Run: ResetHardTo() failed:\n%+v", resetErr)
			}
		}
	}()

	dbDir := bfs.DatabaseDir()

	state := &migrateState{}
	for _, m := range migrations {
		if ov.Lt(m.ver) {
			if err := m.run(dir, dbDir, state); err != nil {
				return nil, xerrors.Errorf("migration(%s) error: %w", m.ver.String(), err)
			}
		}
	}

	// binder.jsonを更新（スキーマ変換後、または初回作成）
	// Schema は 0.3.2 未満との後方互換用フィールド。空にして version のみで管理する。
	meta.Schema = ""
	meta.Version = ver.String()
	meta.MinAppVersion = MinRequiredAppVersion
	if err = fs.SaveMeta(dir, meta); err != nil {
		return nil, xerrors.Errorf("fs.SaveMeta() error: %w", err)
	}

	// binder.jsonへの移行後に旧スキーマファイルを削除
	removeOldSchemaFiles(dir)

	// 旧バインダーに欠損テーブルがある場合（git の旧ブランチ等）は現在のスキーマで作成する。
	// AddDBFiles() を呼ぶ前にすべてのテーブルファイルが存在する状態にする。
	if err = db.EnsureTableFiles(dbDir); err != nil {
		return nil, xerrors.Errorf("EnsureTableFiles() error: %w", err)
	}

	// 旧バインダーに欠損ディレクトリがある場合（git の旧ブランチ等）は作成する。
	// binder.Load() の CheckDirectory で存在を要求されるディレクトリ群を保証する。
	for _, d := range []string{fs.NoteDir, fs.DiagramDir, fs.TemplateDir, fs.AssetDir, fs.LayerDir} {
		target := filepath.Join(dir, d)
		if err = os.MkdirAll(target, 0755); err != nil {
			return nil, xerrors.Errorf("MkdirAll(%s) error: %w", d, err)
		}
	}

	// 0.9.7マイグレーション: diagram_style.tmpl をステージする
	if state.diagramStyleMigrated {
		if err = bfs.AddFile(fs.TemplateFile("diagram_style")); err != nil {
			return nil, xerrors.Errorf("AddFile(diagram_style.tmpl) error: %w", err)
		}
	}

	// 汎用コミット: マイグレーション固有のコミットでカバーされなかった変更をコミットする。
	// バージョンアップのみ（マイグレーション不要）の場合や、個別コミットを持たない
	// マイグレーション（0.1.0, 0.2.0 等）でも binder.json と DB ファイルが確実にコミットされる。
	// 既にコミット済みで変更がない場合は UpdatedFilesError を無視する。
	if err = bfs.AddDBFiles(); err != nil {
		return nil, xerrors.Errorf("AddDBFiles() error: %w", err)
	}
	if err = bfs.AddFile(fs.BinderMetaFile); err != nil {
		return nil, xerrors.Errorf("AddFile(binder.json) error: %w", err)
	}
	if err = bfs.AddFile(fs.GitIgnoreFile); err != nil {
		return nil, xerrors.Errorf("AddFile(.gitignore) error: %w", err)
	}
	commitMsg := fmt.Sprintf("Update binder version (%s -> %s)", ov.String(), ver.String())
	commitErr := bfs.AutoCommit(fs.M(commitMsg, "Schema"), fs.BinderMetaFile)
	if commitErr != nil && !errors.Is(commitErr, fs.UpdatedFilesError) {
		return nil, xerrors.Errorf("AutoCommit(update version) error: %w", commitErr)
	}

	// 移行結果を設定
	result.UserDataRequired = state.gitignorCreated

	return result, nil
}
