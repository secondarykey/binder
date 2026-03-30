package fs

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"

	"github.com/go-git/go-git/v5/plumbing/object"
)

// csvRow はCSVの1行を表す。headerのカラム名→値のマップ。
type csvRow map[string]string

// CSVRowSummary はログ出力用の行サマリ。
type CSVRowSummary struct {
	Id   string
	Name string // name カラムがあれば設定
}

// MergedCSV は3-way CSV マージの結果。
type MergedCSV struct {
	Header        []string
	Rows          []csvRow
	Changed       bool // base から変更があったか
	AddedOurs     []CSVRowSummary // ours のみに追加された行
	AddedTheirs   []CSVRowSummary // theirs のみに追加された行
	DeletedOurs   []CSVRowSummary // ours で削除された行（theirs 側を尊重）
	DeletedTheirs []CSVRowSummary // theirs で削除された行（ours 側を尊重）
	UpdatedOurs   []CSVRowSummary // ours で更新された行
	UpdatedTheirs []CSVRowSummary // theirs で更新された行
}

// mergeCSVFiles は base/ours/theirs の3つのコミットから指定パスの CSV を読み取り、
// ID列ベースの行単位 3-way マージを行う。
// isStructure=true の場合、双方追加された行の parent_id を rootId に、seq を末尾に設定する。
func mergeCSVFiles(baseCommit, oursCommit, theirsCommit *object.Commit,
	path string, isStructure bool, rootId string) (*MergedCSV, error) {

	baseContent, err := readCommitFile(baseCommit, path)
	if err != nil {
		return nil, fmt.Errorf("read base %s: %w", path, err)
	}
	oursContent, err := readCommitFile(oursCommit, path)
	if err != nil {
		return nil, fmt.Errorf("read ours %s: %w", path, err)
	}
	theirsContent, err := readCommitFile(theirsCommit, path)
	if err != nil {
		return nil, fmt.Errorf("read theirs %s: %w", path, err)
	}

	baseRows, header, err := parseCSV(baseContent)
	if err != nil {
		return nil, fmt.Errorf("parse base %s: %w", path, err)
	}
	oursRows, _, err := parseCSV(oursContent)
	if err != nil {
		return nil, fmt.Errorf("parse ours %s: %w", path, err)
	}
	theirsRows, _, err := parseCSV(theirsContent)
	if err != nil {
		return nil, fmt.Errorf("parse theirs %s: %w", path, err)
	}

	return mergeRows(header, baseRows, oursRows, theirsRows, isStructure, rootId)
}

// readCommitFile はコミットからファイル内容を文字列として読み取る。
func readCommitFile(commit *object.Commit, path string) (string, error) {
	f, err := commit.File(path)
	if err != nil {
		return "", err
	}
	return f.Contents()
}

// parseCSV はCSV文字列をパースし、行のスライスとヘッダを返す。
// 各行は map[columnName]value 形式。
func parseCSV(content string) ([]csvRow, []string, error) {
	r := csv.NewReader(strings.NewReader(content))
	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(records) == 0 {
		return nil, nil, fmt.Errorf("empty CSV")
	}

	header := records[0]
	var rows []csvRow
	for _, rec := range records[1:] {
		row := make(csvRow)
		for i, col := range header {
			if i < len(rec) {
				row[col] = rec[i]
			}
		}
		rows = append(rows, row)
	}
	return rows, header, nil
}

// rowsToMap は行スライスを id→row のマップに変換する。
func rowsToMap(rows []csvRow) map[string]csvRow {
	m := make(map[string]csvRow, len(rows))
	for _, row := range rows {
		if id, ok := row["id"]; ok && id != "" {
			m[id] = row
		}
	}
	return m
}

// rowSummary は csvRow からログ用サマリを生成する。
func rowSummary(row csvRow) CSVRowSummary {
	s := CSVRowSummary{Id: row["id"]}
	if name, ok := row["name"]; ok {
		s.Name = name
	}
	return s
}

// mergeRows は3つの行セットをIDベースでマージする。
func mergeRows(header []string, baseRows, oursRows, theirsRows []csvRow,
	isStructure bool, rootId string) (*MergedCSV, error) {

	baseMap := rowsToMap(baseRows)
	oursMap := rowsToMap(oursRows)
	theirsMap := rowsToMap(theirsRows)

	changed := false
	result := make([]csvRow, 0, len(oursRows)+len(theirsRows))
	merged := &MergedCSV{Header: header}

	// ours の行を順に処理（ours の並び順を基準にする）
	for _, row := range oursRows {
		id := row["id"]
		if _, inBase := baseMap[id]; inBase {
			if _, inTheirs := theirsMap[id]; !inTheirs {
				// base にあり theirs で削除 → 削除を尊重（取り込まない）
				changed = true
				merged.DeletedTheirs = append(merged.DeletedTheirs, rowSummary(row))
				continue
			}
		}
		// 双方が同じ行を変更した場合は ours を採用
		if theirsRow, inTheirs := theirsMap[id]; inTheirs {
			if _, inBase := baseMap[id]; inBase {
				baseRow := baseMap[id]
				oursChanged := !rowEqual(baseRow, row)
				theirsChanged := !rowEqual(baseRow, theirsRow)
				if !oursChanged && theirsChanged {
					// ours 未変更、theirs 変更 → theirs を採用
					result = append(result, theirsRow)
					changed = true
					merged.UpdatedTheirs = append(merged.UpdatedTheirs, rowSummary(theirsRow))
					continue
				}
				if oursChanged && theirsChanged {
					// 双方変更 → ours 優先
					merged.UpdatedOurs = append(merged.UpdatedOurs, rowSummary(row))
					changed = true
				} else if oursChanged {
					merged.UpdatedOurs = append(merged.UpdatedOurs, rowSummary(row))
					changed = true
				}
			}
		}
		result = append(result, row)
	}

	// ours で削除されたが theirs に残っている行を確認
	for _, row := range theirsRows {
		id := row["id"]
		if _, inBase := baseMap[id]; inBase {
			if _, inOurs := oursMap[id]; !inOurs {
				// base にあり ours で削除 → 削除を尊重（取り込まない）
				changed = true
				merged.DeletedOurs = append(merged.DeletedOurs, rowSummary(row))
				continue
			}
		}
	}

	// ours のみに追加された行を記録
	for _, row := range oursRows {
		id := row["id"]
		if _, inBase := baseMap[id]; !inBase {
			if _, inTheirs := theirsMap[id]; !inTheirs {
				merged.AddedOurs = append(merged.AddedOurs, rowSummary(row))
			}
		}
	}

	// theirs のみに追加された行を追加
	maxSeq := findMaxSeq(result)
	for _, row := range theirsRows {
		id := row["id"]
		if _, inBase := baseMap[id]; inBase {
			continue // base にある行は既に処理済み
		}
		if _, inOurs := oursMap[id]; inOurs {
			continue // ours にもある行は既に処理済み
		}
		// theirs のみの新規行
		changed = true
		if isStructure {
			row = cloneRow(row)
			row["parent_id"] = rootId
			maxSeq++
			row["seq"] = strconv.Itoa(maxSeq)
		}
		result = append(result, row)
		merged.AddedTheirs = append(merged.AddedTheirs, rowSummary(row))
	}

	merged.Rows = result
	merged.Changed = changed

	return merged, nil
}

// rowEqual は2つの行が全カラムで同じ値かを判定する。
func rowEqual(a, b csvRow) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

// findMaxSeq は行リストから seq カラムの最大値を返す。
func findMaxSeq(rows []csvRow) int {
	max := 0
	for _, row := range rows {
		if s, ok := row["seq"]; ok {
			if n, err := strconv.Atoi(s); err == nil && n > max {
				max = n
			}
		}
	}
	return max
}

// cloneRow は csvRow のコピーを返す。
func cloneRow(row csvRow) csvRow {
	c := make(csvRow, len(row))
	for k, v := range row {
		c[k] = v
	}
	return c
}

// renderCSV はヘッダと行リストからCSV文字列を生成する。
func renderCSV(header []string, rows []csvRow) string {
	var b strings.Builder
	w := csv.NewWriter(&b)
	w.Write(header)
	for _, row := range rows {
		rec := make([]string, len(header))
		for i, col := range header {
			rec[i] = row[col]
		}
		w.Write(rec)
	}
	w.Flush()
	return b.String()
}
