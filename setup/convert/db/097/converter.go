package convert097

import (
	"binder/setup/convert/db/core"
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Convert097 は0.9.7への移行。
// structures.csv に private 列を追加する（デフォルト値: false）。
func Convert097(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	for _, f := range tables {
		nf := f

		if f.This("structures.csv") {
			nf2, err := addPrivateToStructures(p, f)
			if err != nil {
				return nil, xerrors.Errorf("addPrivateToStructures() error: %w", err)
			}
			nf = nf2
		}

		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// addPrivateToStructures は structures.csv に private 列を追加する。
// republish_date 列の直後に挿入する。既に private 列が存在する場合はスキップする。
func addPrivateToStructures(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	nn := "structures097.csv"
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

	// 冪等: private 列が既に存在すればスキップ
	for _, c := range cols {
		if c == "private" {
			np.Close()
			os.Remove(nf)
			return fs, nil
		}
	}

	// republish_date の直後に挿入するインデックスを特定
	insertIdx := -1
	for i, c := range cols {
		if c == "republish_date" {
			insertIdx = i + 1
			break
		}
	}

	// republish_date が見つからない場合は末尾に追加
	var newCols []string
	if insertIdx < 0 {
		newCols = append(cols, "private")
	} else {
		newCols = make([]string, 0, len(cols)+1)
		newCols = append(newCols, cols[:insertIdx]...)
		newCols = append(newCols, "private")
		newCols = append(newCols, cols[insertIdx:]...)
	}

	if _, err = np.Write([]byte(strings.Join(newCols, ",") + "\n")); err != nil {
		return nil, xerrors.Errorf("np.Write(header) error: %w", err)
	}

	// データ行を処理: private カラムにデフォルト値 false を挿入
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		row := strings.Split(line, ",")

		var newRow []string
		if insertIdx < 0 || insertIdx > len(row) {
			newRow = append(row, "false")
		} else {
			newRow = make([]string, 0, len(row)+1)
			newRow = append(newRow, row[:insertIdx]...)
			newRow = append(newRow, "false")
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
