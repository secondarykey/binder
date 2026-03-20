package convert034

import (
	"binder/setup/convert/db/core"
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Convert034 は0.3.4への移行。
// templates.csvにseqカラム（デフォルト値0）を追加する。
func Convert034(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

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

// migrateTemplates はtemplates.csvにseqカラムを追加する
func migrateTemplates(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	nn := "templates034.csv"
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

	// seqカラムが既に存在する場合はそのまま返す
	for _, c := range cols {
		if c == "seq" {
			np.Close()
			os.Remove(nf)
			return fs, nil
		}
	}

	// detailカラムの後にseqを挿入するインデックスを特定
	insertIdx := -1
	for i, c := range cols {
		if c == "detail" {
			insertIdx = i + 1
			break
		}
	}

	// detailが見つからない場合は末尾に追加
	var newCols []string
	if insertIdx < 0 {
		newCols = append(cols, "seq")
	} else {
		newCols = make([]string, 0, len(cols)+1)
		newCols = append(newCols, cols[:insertIdx]...)
		newCols = append(newCols, "seq")
		newCols = append(newCols, cols[insertIdx:]...)
	}

	// ヘッダ行を書き出す
	_, err = np.Write([]byte(strings.Join(newCols, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	// データ行を処理: seqカラムにデフォルト値0を挿入
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		row := strings.Split(line, ",")

		var newRow []string
		if insertIdx < 0 || insertIdx > len(row) {
			newRow = append(row, "0")
		} else {
			newRow = make([]string, 0, len(row)+1)
			newRow = append(newRow, row[:insertIdx]...)
			newRow = append(newRow, "0")
			newRow = append(newRow, row[insertIdx:]...)
		}

		_, err = np.Write([]byte(strings.Join(newRow, ",") + "\n"))
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
