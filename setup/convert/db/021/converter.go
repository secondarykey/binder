package convert021

import (
	"binder/setup/convert/db/core"
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Convert021 は各エンティティテーブルからaliasカラムを抽出し、structures.csvに追加する
func Convert021(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	// 既にstructures.csvがalias列を持つ場合はスキップ
	hasAlias := false
	for _, f := range tables {
		if f.This("structures.csv") || strings.HasSuffix(f.Dst, "structures020.csv") || strings.HasSuffix(f.Dst, "structures021.csv") {
			// structures CSVのヘッダを確認
			fp, err := os.Open(filepath.Join(p, f.Dst))
			if err == nil {
				scanner := bufio.NewScanner(fp)
				if scanner.Scan() {
					if strings.Contains(scanner.Text(), "alias") {
						hasAlias = true
					}
				}
				fp.Close()
			}
		}
	}

	// id -> alias マップを構築（notes, diagrams, assetsから抽出）
	aliasMap := make(map[string]string)

	for _, f := range tables {
		var isEntity bool
		if f.This("notes.csv") || strings.HasSuffix(f.Dst, "notes020.csv") {
			isEntity = true
		} else if f.This("diagrams.csv") || strings.HasSuffix(f.Dst, "diagrams020.csv") {
			isEntity = true
		} else if f.This("assets.csv") || strings.HasSuffix(f.Dst, "assets020.csv") {
			isEntity = true
		}
		if isEntity {
			err := extractAlias(p, f.Dst, aliasMap)
			if err != nil {
				return nil, xerrors.Errorf("extractAlias(%s) error: %w", f.Dst, err)
			}
		}
	}

	for _, f := range tables {
		nf := f

		if !hasAlias {
			if f.This("structures.csv") || strings.HasSuffix(f.Dst, "structures020.csv") {
				nf2, err := addAliasToStructures(p, f, aliasMap)
				if err != nil {
					return nil, xerrors.Errorf("addAliasToStructures() error: %w", err)
				}
				nf = nf2
			}
		}

		// エンティティテーブルからaliasカラムを除去
		if f.This("notes.csv") || strings.HasSuffix(f.Dst, "notes020.csv") {
			nf2, err := removeAliasColumn(p, f, "notes")
			if err != nil {
				return nil, xerrors.Errorf("removeAliasColumn(notes) error: %w", err)
			}
			nf = nf2
		} else if f.This("diagrams.csv") || strings.HasSuffix(f.Dst, "diagrams020.csv") {
			nf2, err := removeAliasColumn(p, f, "diagrams")
			if err != nil {
				return nil, xerrors.Errorf("removeAliasColumn(diagrams) error: %w", err)
			}
			nf = nf2
		} else if f.This("assets.csv") || strings.HasSuffix(f.Dst, "assets020.csv") {
			nf2, err := removeAliasColumn(p, f, "assets")
			if err != nil {
				return nil, xerrors.Errorf("removeAliasColumn(assets) error: %w", err)
			}
			nf = nf2
		}

		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// extractAlias はCSVファイルからid -> aliasマップを構築する
func extractAlias(p, filename string, aliasMap map[string]string) error {

	fp, err := os.Open(filepath.Join(p, filename))
	if err != nil {
		return xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		return nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// aliasカラムのインデックスを検索
	aliasIdx := -1
	for i, c := range cols {
		if c == "alias" {
			aliasIdx = i
			break
		}
	}
	if aliasIdx < 0 {
		// aliasカラムが存在しない（既に変換済み）
		return nil
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")
		if len(row) > aliasIdx {
			id := row[0]
			alias := row[aliasIdx]
			if alias != "" {
				aliasMap[id] = alias
			}
		}
	}

	return scanner.Err()
}

// addAliasToStructures はstructures.csvにaliasカラムを追加する
func addAliasToStructures(p string, fs *core.FileSet, aliasMap map[string]string) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	nn := "structures021.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	scanner := bufio.NewScanner(fp)
	// ヘッダ行
	if !scanner.Scan() {
		return nil, fmt.Errorf("empty structures file")
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// aliasが既に含まれているか確認
	alreadyHasAlias := false
	for _, c := range cols {
		if c == "alias" {
			alreadyHasAlias = true
			break
		}
	}

	if alreadyHasAlias {
		// 変換不要: 元のファイルセットを返す
		np.Close()
		os.Remove(nf)
		return fs, nil
	}

	// detail列の後にaliasを挿入（detailはindex 5）
	detailIdx := -1
	for i, c := range cols {
		if c == "detail" {
			detailIdx = i
			break
		}
	}

	var newHeader []string
	if detailIdx >= 0 {
		newHeader = append(cols[:detailIdx+1], append([]string{"alias"}, cols[detailIdx+1:]...)...)
	} else {
		newHeader = append(cols, "alias")
	}

	_, err = np.Write([]byte(strings.Join(newHeader, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")
		id := ""
		if len(row) > 0 {
			id = row[0]
		}
		alias, ok := aliasMap[id]
		if !ok {
			alias = id
		}

		var newRow []string
		if detailIdx >= 0 && len(row) > detailIdx {
			newRow = append(row[:detailIdx+1], append([]string{alias}, row[detailIdx+1:]...)...)
		} else {
			newRow = append(row, alias)
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

// removeAliasColumn はCSVファイルからaliasカラムを除去する
func removeAliasColumn(p string, fs *core.FileSet, tableName string) (*core.FileSet, error) {

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

	// aliasカラムのインデックスを検索
	aliasIdx := -1
	for i, c := range cols {
		if c == "alias" {
			aliasIdx = i
			break
		}
	}
	if aliasIdx < 0 {
		// aliasカラムが存在しない（既に変換済み）
		fp.Close()
		return fs, nil
	}

	nn := tableName + "021.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	// ヘッダ行を出力（aliasを除去）
	newCols := make([]string, 0, len(cols)-1)
	for i, c := range cols {
		if i != aliasIdx {
			newCols = append(newCols, c)
		}
	}
	_, err = np.Write([]byte(strings.Join(newCols, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")
		newRow := make([]string, 0, len(row)-1)
		for i, v := range row {
			if i != aliasIdx {
				newRow = append(newRow, v)
			}
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
