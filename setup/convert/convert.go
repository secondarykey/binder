package convert

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	. "binder/internal"

	"binder/db"
	"binder/fs"
	dbconvert "binder/setup/convert/db"
	convert010 "binder/setup/convert/db/010"
	convert020 "binder/setup/convert/db/020"
	convert021 "binder/setup/convert/db/021"
	convert022 "binder/setup/convert/db/022"
	convert033 "binder/setup/convert/db/033"
	convert034 "binder/setup/convert/db/034"
	convert045 "binder/setup/convert/db/045"
	convert047 "binder/setup/convert/db/047"
	convert048 "binder/setup/convert/db/048"
	convert092 "binder/setup/convert/db/092"
	convert097 "binder/setup/convert/db/097"
	fsconvert "binder/setup/convert/fs"

	"golang.org/x/xerrors"
)

var v010, v020, v021, v022, v033, v034, v045, v047, v048, v072, v092, v097 *Version

// migrateState は移行処理中の内部状態を保持する
type migrateState struct {
	configMigrated        bool
	configName            string
	configDetail          string
	docsMigrated          bool
	gitignorCreated       bool
	diagramStyleMigrated  bool
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

	v010, err = NewVersion("0.1.0")
	if err != nil {
		panic("v010 version parse error: " + err.Error())
	}
	v020, err = NewVersion("0.2.0")
	if err != nil {
		panic("v020 version parse error: " + err.Error())
	}
	v021, err = NewVersion("0.2.1")
	if err != nil {
		panic("v021 version parse error: " + err.Error())
	}
	v022, err = NewVersion("0.2.2")
	if err != nil {
		panic("v022 version parse error: " + err.Error())
	}
	v033, err = NewVersion("0.3.3")
	if err != nil {
		panic("v033 version parse error: " + err.Error())
	}
	v034, err = NewVersion("0.3.4")
	if err != nil {
		panic("v034 version parse error: " + err.Error())
	}
	v045, err = NewVersion("0.4.5")
	if err != nil {
		panic("v045 version parse error: " + err.Error())
	}
	v047, err = NewVersion("0.4.7")
	if err != nil {
		panic("v047 version parse error: " + err.Error())
	}
	v048, err = NewVersion("0.4.8")
	if err != nil {
		panic("v048 version parse error: " + err.Error())
	}
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
	migrations = []migration{
		// 0.1.0: assets.csv に binary 列を追加
		{v010, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert010.Convert010)
		}},
		// 0.2.0: structures.csv を新規作成し、各テーブルから parent_id/name/detail を分離
		{v020, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert020.Convert020)
		}},
		// 0.2.1: alias を各テーブルから structures.csv に集約
		{v021, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert021.Convert021)
		}},
		// 0.2.2: CSV変換（変更なし）後、assets ディレクトリをフラット化
		{v022, func(dir, dbDir string, _ *migrateState) error {
			if err := applyDB(dbDir, convert022.Convert022); err != nil {
				return err
			}
			return fsconvert.MigrateV022(dir)
		}},
		// 0.3.3: templates.csv からsnippet型を削除し型名をリネーム
		{v033, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert033.Convert033)
		}},
		// 0.3.4: templates.csv に seq 列を追加
		{v034, func(_, dbDir string, _ *migrateState) error {
			return applyDB(dbDir, convert034.Convert034)
		}},
		// 0.4.5: config.csv を削除し、name/detail を binder.json へ移行
		// Apply で config.csv が削除される前に値を読み込む
		{v045, func(_, dbDir string, state *migrateState) error {
			state.configMigrated = true
			state.configName, state.configDetail = readConfigCSV(dbDir)
			return applyDB(dbDir, convert045.Convert045)
		}},
		// 0.4.7: publish_date/republish_date を structures に移動し、
		// notes/diagrams から publish_date を削除。docs ディレクトリをクリア。
		{v047, func(dir, dbDir string, state *migrateState) error {
			if err := applyDB(dbDir, convert047.Convert047); err != nil {
				return err
			}
			state.docsMigrated = true
			return fsconvert.MigrateV047(dir)
		}},
		// 0.4.8: メタファイルのパスを assets/{noteId}-meta → assets/meta/{noteId} に変更
		{v048, func(dir, dbDir string, _ *migrateState) error {
			if err := applyDB(dbDir, convert048.Convert048); err != nil {
				return err
			}
			return fsconvert.MigrateV048(dir)
		}},
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

// Run はバインダーレベルの全移行処理を実行する。
// binder.json を読み込んで現在のスキーマバージョンを取得し、必要な移行を順番に適用する。
// 移行後は binder.json を更新して保存し、git コミットまで完結させる。
// 各移行は CSV スキーマ変換とファイルシステム移行を含む自己完結した処理単位。
func Run(dir string, ver *Version) (*MigrateResult, error) {

	result := &MigrateResult{}

	if ver == nil {
		return result, nil
	}

	meta, err := loadMeta(dir)
	if err != nil {
		return nil, xerrors.Errorf("loadMeta() error: %w", err)
	}

	ov, err := NewVersion(meta.Version)
	if err != nil {
		return nil, xerrors.Errorf("NewVersion() error: %w", err)
	}

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("Load() error: %w", err)
	}

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
	// 0.3.2マイグレーション: schemaフィールドを空にしてappバージョンのみで管理する。
	// 0.4.5マイグレーション: config.csvのname/detailをbinder.jsonに移行する。
	meta.Schema = ""
	meta.Version = ver.String()
	if state.configMigrated && meta.Name == "" {
		meta.Name = state.configName
		meta.Detail = state.configDetail
	}
	if err = fs.SaveMeta(dir, meta); err != nil {
		return nil, xerrors.Errorf("fs.SaveMeta() error: %w", err)
	}

	// binder.jsonへの移行後に旧スキーマファイルを削除
	removeOldSchemaFiles(dir)

	// 0.4.5マイグレーション: config.csv削除とbinder.json更新をgitにコミット
	// config.csvの削除を明示的にステージし、binder.jsonの更新と合わせてコミットする。
	// 変更がない場合（新規インストール等）はUpdatedFilesErrorを無視する。
	if state.configMigrated {
		// config.csv が追跡済みの場合は削除をステージ（未追跡の場合は無視）
		_ = bfs.RemoveFile(fs.DBDir + "/" + db.ConfigTableName + ".csv")
		// binder.json をステージ
		if err = bfs.AddFile(fs.BinderMetaFile); err != nil {
			return nil, xerrors.Errorf("AddFile(binder.json) error: %w", err)
		}
		commitMsg := fmt.Sprintf("Migrate Config to binder.json (%s -> %s)", ov.String(), ver.String())
		commitErr := bfs.AutoCommit(fs.M(commitMsg, "Schema"), fs.BinderMetaFile)
		if commitErr != nil && !errors.Is(commitErr, fs.UpdatedFilesError) {
			return nil, xerrors.Errorf("AutoCommit(migrate) error: %w", commitErr)
		}
	}

	// 0.4.7マイグレーション: CSVスキーマ変更・docs削除・binder.json更新をgitにコミット
	// CSV変更（structures/notes/diagrams）をステージし、docs/配下の削除済みファイルも
	// ステージしてbinder.jsonと合わせてコミットする。
	// docs/にコンテンツがない場合（未公開状態等）はUpdatedFilesErrorを無視する。
	if state.docsMigrated {
		// 変更されたCSVファイルをステージ
		if err = bfs.AddDBFiles(); err != nil {
			return nil, xerrors.Errorf("AddDBFiles() error: %w", err)
		}
		// docs/ 配下の削除済みファイルをステージ（追跡済みのもののみ）
		if err = bfs.StagePublishDirRemovals(); err != nil {
			return nil, xerrors.Errorf("StagePublishDirRemovals() error: %w", err)
		}
		// binder.json をステージ
		if err = bfs.AddFile(fs.BinderMetaFile); err != nil {
			return nil, xerrors.Errorf("AddFile(binder.json) error: %w", err)
		}
		commitMsg := fmt.Sprintf("Migrate schema 0.4.7: move publish dates to structures, clear docs/ (%s -> %s)", ov.String(), ver.String())
		commitErr := bfs.AutoCommit(fs.M(commitMsg, "Schema"), fs.BinderMetaFile)
		if commitErr != nil && !errors.Is(commitErr, fs.UpdatedFilesError) {
			return nil, xerrors.Errorf("AutoCommit(migrate 047) error: %w", commitErr)
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

	// 旧バインダーに欠損テーブルがある場合（git の旧ブランチ等）は現在のスキーマで作成する
	if err = db.EnsureTableFiles(dbDir); err != nil {
		return nil, xerrors.Errorf("EnsureTableFiles() error: %w", err)
	}

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
