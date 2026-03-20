package convert033

import (
	"binder/setup/convert/db/core"
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// snippetTypes はtemplatesテーブルから削除するタイプ一覧
var snippetTypes = map[string]bool{
	"note":     true,
	"diagram":  true,
	"template": true,
}

// typeRenames はtemplatesテーブルのtypeカラム値のリネームマッピング
var typeRenames = map[string]string{
	"html_layout":  "layout",
	"html_content": "content",
}

// Convert033 は0.3.3への移行。
// templates.csvからsnippet用タイプ（note, diagram, template）の行を削除し、
// html_layout→layout, html_content→content にタイプ値を変更する。
func Convert033(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	for _, f := range tables {
		nf := f

		if f.This("templates.csv") {
			nf2, err := migrateTemplates(p, f)
			if err != nil {
				return nil, xerrors.Errorf("migrateTemplates() error: %w", err)
			}
			nf = nf2
		}

		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// migrateTemplates はtemplates.csvのsnippet行を削除し、型名を変更する
func migrateTemplates(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	nn := "templates033.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	scanner := bufio.NewScanner(fp)

	// ヘッダ行を読み込み、typeカラムのインデックスを特定
	if !scanner.Scan() {
		// 空ファイルの場合はそのまま返す
		np.Close()
		os.Remove(nf)
		return fs, nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	typeIdx := -1
	for i, c := range cols {
		if c == "type" {
			typeIdx = i
			break
		}
	}

	// ヘッダ行を書き出す
	_, err = np.Write([]byte(headerLine + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	// データ行を処理
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		row := strings.Split(line, ",")

		// typeカラムが見つからない場合はそのまま通す
		if typeIdx < 0 || typeIdx >= len(row) {
			_, err = np.Write([]byte(line + "\n"))
			if err != nil {
				return nil, xerrors.Errorf("fp.Write(row) error: %w", err)
			}
			continue
		}

		typ := row[typeIdx]

		// snippet用タイプは削除
		if snippetTypes[typ] {
			continue
		}

		// html_layout/html_content を layout/content にリネーム
		if newTyp, ok := typeRenames[typ]; ok {
			row[typeIdx] = newTyp
		}

		_, err = np.Write([]byte(strings.Join(row, ",") + "\n"))
		if err != nil {
			return nil, xerrors.Errorf("fp.Write(row) error: %w", err)
		}
	}

	if err = scanner.Err(); err != nil {
		return nil, xerrors.Errorf("scanner error: %w", err)
	}

	nfs := core.NewFileSet(fs.Org)
	nfs.Dst = nn
	return nfs, nil
}
