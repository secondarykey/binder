package convert098

import (
	"binder/setup/convert/db/core"
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Convert098 は0.9.8への移行。
// diagrams.csv に style_template 列を追加する（デフォルト値: 空文字列）。
func Convert098(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	for _, f := range tables {
		nf := f

		if f.This("diagrams.csv") {
			nf2, err := addStyleTemplateToDiagrams(p, f)
			if err != nil {
				return nil, xerrors.Errorf("addStyleTemplateToDiagrams() error: %w", err)
			}
			nf = nf2
		}

		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// addStyleTemplateToDiagrams は diagrams.csv に style_template 列を追加する。
// id 列の直後に挿入する。既に style_template 列が存在する場合はスキップする。
func addStyleTemplateToDiagrams(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	nn := "diagrams098.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	scanner := bufio.NewScanner(fp)

	// ヘッダ行を読み込む
	if !scanner.Scan() {
		// 空ファイルの場合はそのまま返す
		np.Close()
		os.Remove(nf)
		return fs, nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// 冪等: style_template 列が既に存在すればスキップ
	for _, c := range cols {
		if c == "style_template" {
			np.Close()
			os.Remove(nf)
			return fs, nil
		}
	}

	// id の直後に挿入するインデックスを特定
	insertIdx := -1
	for i, c := range cols {
		if c == "id" {
			insertIdx = i + 1
			break
		}
	}

	// id が見つからない場合は末尾に追加
	var newCols []string
	if insertIdx < 0 {
		newCols = append(cols, "style_template")
	} else {
		newCols = make([]string, 0, len(cols)+1)
		newCols = append(newCols, cols[:insertIdx]...)
		newCols = append(newCols, "style_template")
		newCols = append(newCols, cols[insertIdx:]...)
	}

	if _, err = np.Write([]byte(strings.Join(newCols, ",") + "\n")); err != nil {
		return nil, xerrors.Errorf("np.Write(header) error: %w", err)
	}

	// データ行を処理: style_template カラムにデフォルト値（空文字列）を挿入
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		row := strings.Split(line, ",")

		var newRow []string
		if insertIdx < 0 || insertIdx > len(row) {
			newRow = append(row, "")
		} else {
			newRow = make([]string, 0, len(row)+1)
			newRow = append(newRow, row[:insertIdx]...)
			newRow = append(newRow, "")
			newRow = append(newRow, row[insertIdx:]...)
		}

		if _, err = np.Write([]byte(strings.Join(newRow, ",") + "\n")); err != nil {
			return nil, xerrors.Errorf("np.Write(row) error: %w", err)
		}
	}

	if err = scanner.Err(); err != nil {
		return nil, xerrors.Errorf("scanner error: %w", err)
	}

	nfs := core.NewFileSet(fs.Org)
	nfs.Dst = nn
	return nfs, nil
}
