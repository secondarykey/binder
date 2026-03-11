package convert047

import (
	"binder/db/convert/core"
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

const timeZero = "0001-01-01T00:00:00Z"

// Convert047 は0.4.7への移行。
// structures.csv に publish_date, republish_date 列を追加（値は全てゼロ時刻）。
// notes.csv と diagrams.csv から publish_date 列を削除する。
func Convert047(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	for _, f := range tables {
		nf := f

		if f.This("structures.csv") {
			nf2, err := addPublishToStructures(p, f)
			if err != nil {
				return nil, xerrors.Errorf("addPublishToStructures() error: %w", err)
			}
			nf = nf2
		} else if f.This("notes.csv") {
			nf2, err := removePublishDate(p, f, "notes")
			if err != nil {
				return nil, xerrors.Errorf("removePublishDate(notes) error: %w", err)
			}
			nf = nf2
		} else if f.This("diagrams.csv") {
			nf2, err := removePublishDate(p, f, "diagrams")
			if err != nil {
				return nil, xerrors.Errorf("removePublishDate(diagrams) error: %w", err)
			}
			nf = nf2
		}

		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// addPublishToStructures は structures.csv に publish_date, republish_date 列を追加する。
// 既に publish_date 列が存在する場合はスキップする。
func addPublishToStructures(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		return nil, fmt.Errorf("empty structures file")
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// 既に publish_date が含まれている場合はスキップ
	for _, c := range cols {
		if c == "publish_date" {
			return fs, nil
		}
	}

	// updated_user 列の後に publish_date, republish_date を挿入
	updatedUserIdx := -1
	for i, c := range cols {
		if c == "updated_user" {
			updatedUserIdx = i
			break
		}
	}

	var newHeader []string
	if updatedUserIdx >= 0 {
		newHeader = append(cols[:updatedUserIdx+1], append([]string{"publish_date", "republish_date"}, cols[updatedUserIdx+1:]...)...)
	} else {
		newHeader = append(cols, "publish_date", "republish_date")
	}

	nn := "structures047.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	_, err = np.Write([]byte(strings.Join(newHeader, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("np.Write(header) error: %w", err)
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")

		var newRow []string
		if updatedUserIdx >= 0 && len(row) > updatedUserIdx {
			newRow = append(row[:updatedUserIdx+1], append([]string{timeZero, timeZero}, row[updatedUserIdx+1:]...)...)
		} else {
			newRow = append(row, timeZero, timeZero)
		}

		_, err = np.Write([]byte(strings.Join(newRow, ",") + "\n"))
		if err != nil {
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

// removePublishDate は CSV ファイルから publish_date 列を除去する。
// 既に列が存在しない場合はスキップする。
func removePublishDate(p string, fs *core.FileSet, tableName string) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		return fs, nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// publish_date 列のインデックスを検索
	publishIdx := -1
	for i, c := range cols {
		if c == "publish_date" {
			publishIdx = i
			break
		}
	}
	if publishIdx < 0 {
		// 列が存在しない（既に変換済み）
		return fs, nil
	}

	nn := tableName + "047.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	// ヘッダ行を出力（publish_date を除去）
	newCols := make([]string, 0, len(cols)-1)
	for i, c := range cols {
		if i != publishIdx {
			newCols = append(newCols, c)
		}
	}
	_, err = np.Write([]byte(strings.Join(newCols, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("np.Write(header) error: %w", err)
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")
		newRow := make([]string, 0, len(row)-1)
		for i, v := range row {
			if i != publishIdx {
				newRow = append(newRow, v)
			}
		}
		_, err = np.Write([]byte(strings.Join(newRow, ",") + "\n"))
		if err != nil {
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
