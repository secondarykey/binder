package convert020

import (
	"binder/db/convert/core"
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

func Convert020(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet
	var err error

	// 各テーブルからparent_id, name, detailを抽出してstructures.csvを生成
	var entries []extractEntry
	seqMap := make(map[string]int) // parentId -> current seq

	// 既にstructures.csvが存在する場合はスキップ（既に変換済み or 前回の中断後）
	hasStructures := false
	for _, f := range tables {
		if f.This("structures.csv") || f.This("structures020.csv") {
			hasStructures = true
		}
	}

	for _, f := range tables {
		nf := f

		if !hasStructures {
			if f.This("notes.csv") {
				e, nf2, err := extractAndRemove(p, f, "notes", "note", []int{1, 3, 4})
				if err != nil {
					return nil, xerrors.Errorf("extractAndRemove(notes) error: %w", err)
				}
				entries = append(entries, e...)
				nf = nf2
			} else if f.This("diagrams.csv") {
				e, nf2, err := extractAndRemove(p, f, "diagrams", "diagram", []int{1, 3, 4})
				if err != nil {
					return nil, xerrors.Errorf("extractAndRemove(diagrams) error: %w", err)
				}
				entries = append(entries, e...)
				nf = nf2
			} else if f.This("assets.csv") {
				e, nf2, err := extractAndRemove(p, f, "assets", "asset", []int{1, 3, 4})
				if err != nil {
					return nil, xerrors.Errorf("extractAndRemove(assets) error: %w", err)
				}
				entries = append(entries, e...)
				nf = nf2
			}
		}

		rtn = append(rtn, nf)
	}

	// structures.csvが既にある場合はスキップ
	if hasStructures {
		return rtn, nil
	}

	// structures.csvを生成
	sf := filepath.Join(p, "structures020.csv")
	fp, err := os.Create(sf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create(structures) error: %w", err)
	}
	defer fp.Close()

	_, err = fp.Write([]byte("id,parent_id,seq,type,name,detail,created_date,created_user,updated_date,updated_user\n"))
	if err != nil {
		return nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	now := time.Now().Format(time.RFC3339Nano)
	for _, e := range entries {
		seq := seqMap[e.parentId] + 1
		seqMap[e.parentId] = seq

		line := fmt.Sprintf("%s,%s,%d,%s,%s,%s,%s,system,%s,system\n",
			e.id, e.parentId, seq, e.typ, e.name, e.detail, now, now)
		_, err = fp.Write([]byte(line))
		if err != nil {
			return nil, xerrors.Errorf("fp.Write(entry) error: %w", err)
		}
	}

	// structures.csvをファイルセットに追加
	sfs := core.NewFileSet("structures.csv")
	sfs.Dst = "structures020.csv"
	rtn = append(rtn, sfs)

	return rtn, nil
}

type extractEntry struct {
	id       string
	parentId string
	name     string
	detail   string
	typ      string
}

// extractAndRemove は元CSVからparent_id, name, detailを抽出し、それらを除去した新CSVを出力する
// removeIdxs はparent_id, name, detailのカラムインデックス（0-based）
// ヘッダに削除対象カラムが存在しない場合（既に変換済み）はスキップする
func extractAndRemove(p string, fs *core.FileSet, tableName, typ string, removeIdxs []int) ([]extractEntry, *core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)

	fp, err := os.Open(of)
	if err != nil {
		return nil, nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	// ヘッダ行を先読みして、削除対象カラムが存在するか確認
	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		// 空ファイルの場合はスキップ
		return nil, fs, nil
	}
	headerLine := scanner.Text()
	headerCols := strings.Split(headerLine, ",")

	maxIdx := removeIdxs[len(removeIdxs)-1]
	if len(headerCols) <= maxIdx {
		// カラム数が足りない → 既に変換済み。元のファイルセットをそのまま返す
		fp.Close()
		return nil, fs, nil
	}

	// parent_idカラムが存在するか確認（二重変換防止）
	if headerCols[removeIdxs[0]] != "parent_id" {
		fp.Close()
		return nil, fs, nil
	}

	nn := tableName + "020.csv"
	nf := filepath.Join(p, nn)

	np, err := os.Create(nf)
	if err != nil {
		return nil, nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	removeSet := make(map[int]bool)
	for _, idx := range removeIdxs {
		removeSet[idx] = true
	}

	// ヘッダ行を出力（削除対象カラムを除去）
	newCols := make([]string, 0, len(headerCols)-len(removeIdxs))
	for idx, col := range headerCols {
		if !removeSet[idx] {
			newCols = append(newCols, col)
		}
	}
	_, err = np.Write([]byte(strings.Join(newCols, ",") + "\n"))
	if err != nil {
		return nil, nil, xerrors.Errorf("fp.Write(header) error: %w", err)
	}

	// データ行を処理
	var entries []extractEntry
	for scanner.Scan() {
		line := scanner.Text()
		csv := strings.Split(line, ",")

		if len(csv) <= maxIdx {
			continue
		}

		var e extractEntry
		e.id = csv[0]
		e.parentId = csv[removeIdxs[0]] // parent_id
		e.name = csv[removeIdxs[1]]     // name
		e.detail = csv[removeIdxs[2]]   // detail
		e.typ = typ
		entries = append(entries, e)

		// parent_id, name, detailを除去した行を出力
		dataCols := make([]string, 0, len(csv)-len(removeIdxs))
		for idx, col := range csv {
			if !removeSet[idx] {
				dataCols = append(dataCols, col)
			}
		}
		_, err = np.Write([]byte(strings.Join(dataCols, ",") + "\n"))
		if err != nil {
			return nil, nil, xerrors.Errorf("fp.Write(data) error: %w", err)
		}
	}

	if err = scanner.Err(); err != nil {
		return nil, nil, xerrors.Errorf("scanner error: %w", err)
	}

	nfs := core.NewFileSet(fs.Org)
	nfs.Dst = nn

	return entries, nfs, nil
}
