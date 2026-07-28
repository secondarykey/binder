package convert

import (
	"os"
	"path/filepath"

	"binder/fs"
	convert092 "binder/setup/convert/db/092"
	convert097 "binder/setup/convert/db/097"
	"binder/setup/convert/db/core"

	"golang.org/x/xerrors"
)

// schemaRepairs はバージョン判定に依存せず適用できる冪等なCSVスキーマ修復。
//
// migrations と違い「旧バージョンより新しいか」で絞り込まず、常に全件を実行する。
// 各コンバーターは対象カラムが既に存在すれば元の FileSet をそのまま返すため、
// 修復済みのバインダーに対しては実質的に no-op（ヘッダ1行の読み取りのみ）になる。
//
// バージョン判定に頼れないのは、過去に移行ラベルの付け間違いがあったため。
// 0.9.2 の assets.mime は当初 0.8.3 ラベルで実装され v0.8.3〜v0.9.3 のアプリに
// そのまま載っていた。この間にバインダーを開くと ov.Lt(0.8.3) が偽になって
// カラム追加がスキップされる一方、convert.Run() は移行の適用有無に関わらず
// binder.json のバージョンを現在のアプリバージョンへ更新するため、
// mime 列を持たないまま新しいバージョンとして記録されたバインダーが生まれた。
// 後の修正でラベルは 0.9.2 になったが（実際の出荷は v0.9.4）、
// 既により新しいバージョンとして記録済みのバインダーは
// どのバージョン比較でも救えないため、カラムの実在を見て直す。
var schemaRepairs = []core.Converter{
	convert092.Convert092,
	convert097.Convert097,
}

// RepairSchema は db ディレクトリのCSVヘッダを検査し、欠損しているカラムを補う。
// 返り値は変更されたファイルのgitパス（例: db/assets.csv）。
//
// csvq はカラムが欠けているとクエリ自体が失敗するため（SELECT 時に
// "field mime does not exist"）、db を開く前に呼ぶ必要がある。
func RepairSchema(dir, dbDir string) ([]string, error) {

	matches, err := filepath.Glob(filepath.Join(dbDir, "*.csv"))
	if err != nil {
		return nil, xerrors.Errorf("filepath.Glob() error: %w", err)
	}
	if len(matches) == 0 {
		return nil, nil
	}

	sets := make([]*core.FileSet, 0, len(matches))
	for _, m := range matches {
		sets = append(sets, core.NewFileSet(filepath.Base(m)))
	}

	for _, c := range schemaRepairs {
		sets, err = c(dbDir, sets)
		if err != nil {
			return nil, xerrors.Errorf("converter call error: %w", err)
		}
	}

	// dbconvert.Apply() と異なり、FileSet に含まれないファイルの削除は行わない。
	// 修復は Load() のたびに走るため、db ディレクトリ内の想定外のファイルを
	// 消してしまわないよう、変更されたテーブルのリネームだけを行う。
	var changed []string
	for _, set := range sets {
		if !set.IsChange() {
			continue
		}
		src := filepath.Join(dbDir, set.Dst)
		dst := filepath.Join(dbDir, set.Org)
		if err = os.Rename(src, dst); err != nil {
			return nil, xerrors.Errorf("os.Rename(%s -> %s) error: %w", set.Dst, set.Org, err)
		}
		changed = append(changed, fs.DBDir+"/"+set.Org)
	}

	// templates.csv に diagram_style レコードだけが入って実体ファイルが無い状態を
	// 作らないよう、0.9.7 のFS移行分もあわせて保証する（冪等）。
	created, err := ensureDiagramStyleTemplate(dir)
	if err != nil {
		return nil, xerrors.Errorf("ensureDiagramStyleTemplate() error: %w", err)
	}
	if created {
		changed = append(changed, fs.TemplateFile(DiagramStyleTemplate))
	}

	return changed, nil
}

// DiagramStyleTemplate は 0.9.7 で追加されたダイアグラムスタイルテンプレートのID。
const DiagramStyleTemplate = "diagram_style"

// diagramStyleContent は diagram_style.tmpl の初期内容。
const diagramStyleContent = "{'theme':'base'}"

// ensureDiagramStyleTemplate は templates/diagram_style.tmpl が無ければ作成する。
// 作成した場合のみ true を返す（冪等）。
func ensureDiagramStyleTemplate(dir string) (bool, error) {

	tmplPath := filepath.Join(dir, fs.TemplateDir, DiagramStyleTemplate+".tmpl")
	if _, err := os.Stat(tmplPath); err == nil {
		return false, nil
	} else if !os.IsNotExist(err) {
		return false, xerrors.Errorf("os.Stat() error: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(tmplPath), 0755); err != nil {
		return false, xerrors.Errorf("MkdirAll(templates) error: %w", err)
	}
	if err := os.WriteFile(tmplPath, []byte(diagramStyleContent), 0644); err != nil {
		return false, xerrors.Errorf("os.WriteFile(diagram_style.tmpl) error: %w", err)
	}
	return true, nil
}
