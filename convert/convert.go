package convert

import (
	. "binder/internal"

	dbconvert "binder/db/convert"
	convert010 "binder/db/convert/010"
	convert020 "binder/db/convert/020"
	convert021 "binder/db/convert/021"
	convert022 "binder/db/convert/022"
	convert033 "binder/db/convert/033"
	convert034 "binder/db/convert/034"
	convert045 "binder/db/convert/045"
	fsconvert "binder/fs/convert"

	"golang.org/x/xerrors"
)

var v010, v020, v021, v022, v033, v034, v045 *Version

// migration はひとつのバージョン移行を表す。
// run がそのバージョンへの移行に必要な全処理（CSV変換＋FS移行）を担う。
type migration struct {
	ver *Version
	run func(dir, dbDir string, result *Result) error
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

	migrations = []migration{
		// 0.1.0: assets.csv に binary 列を追加
		{v010, func(_, dbDir string, _ *Result) error {
			return applyDB(dbDir, convert010.Convert010)
		}},
		// 0.2.0: structures.csv を新規作成し、各テーブルから parent_id/name/detail を分離
		{v020, func(_, dbDir string, _ *Result) error {
			return applyDB(dbDir, convert020.Convert020)
		}},
		// 0.2.1: alias を各テーブルから structures.csv に集約
		{v021, func(_, dbDir string, _ *Result) error {
			return applyDB(dbDir, convert021.Convert021)
		}},
		// 0.2.2: CSV変換（変更なし）後、assets ディレクトリをフラット化
		{v022, func(dir, dbDir string, _ *Result) error {
			if err := applyDB(dbDir, convert022.Convert022); err != nil {
				return err
			}
			return fsconvert.MigrateV022(dir)
		}},
		// 0.3.3: templates.csv からsnippet型を削除し型名をリネーム
		{v033, func(_, dbDir string, _ *Result) error {
			return applyDB(dbDir, convert033.Convert033)
		}},
		// 0.3.4: templates.csv に seq 列を追加
		{v034, func(_, dbDir string, _ *Result) error {
			return applyDB(dbDir, convert034.Convert034)
		}},
		// 0.4.5: config.csv を削除し、name/detail を binder.json へ移行
		// Apply で config.csv が削除される前に値を読み込む
		{v045, func(_, dbDir string, result *Result) error {
			result.ConfigMigrated = true
			result.ConfigName, result.ConfigDetail = readConfigCSV(dbDir)
			return applyDB(dbDir, convert045.Convert045)
		}},
	}
}

// Result は移行処理の結果
type Result struct {
	// 0.4.5移行: config.csvから読んだname/detail（ConfigMigrated=trueの場合のみ有効）
	ConfigName   string
	ConfigDetail string
	// ConfigMigrated は0.4.5移行が実行されたかどうかを示す
	ConfigMigrated bool
}

// applyDB はひとつの CSV コンバーターを db ディレクトリに適用するヘルパー
func applyDB(dbDir string, c dbconvert.Converter) error {
	return dbconvert.Apply(dbDir, []dbconvert.Converter{c})
}

// Run はバインダーレベルの全移行処理を実行する。
// migrations リストをバージョン順に走査し、ov より新しい移行を順番に適用する。
// 各移行は CSV スキーマ変換とファイルシステム移行を含む自己完結した処理単位。
func Run(dir, dbDir string, ov, ver *Version) (*Result, error) {

	result := &Result{}

	if ver == nil {
		return result, nil
	}

	for _, m := range migrations {
		if ov.Lt(m.ver) {
			if err := m.run(dir, dbDir, result); err != nil {
				return nil, xerrors.Errorf("migration(%s) error: %w", m.ver.String(), err)
			}
		}
	}

	return result, nil
}
