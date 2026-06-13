package fs

import "testing"

// row はテスト用に csvRow を簡潔に生成するヘルパー。
func row(id, parent, seq string) csvRow {
	return csvRow{"id": id, "parent_id": parent, "seq": seq, "name": id}
}

// findRow は結果から id の行を探す。
func findRow(rows []csvRow, id string) (csvRow, bool) {
	for _, r := range rows {
		if r["id"] == id {
			return r, true
		}
	}
	return nil, false
}

// theirs のみに追加されたネストノードは parent_id/seq を維持したまま取り込まれること。
// （旧実装では無条件で index 直下へフラット化されていた）
func TestMergeRowsKeepsTheirsNestedParent(t *testing.T) {
	header := []string{"id", "parent_id", "seq", "name"}
	base := []csvRow{
		row("index", "", "0"),
		row("F", "index", "1"), // 既存フォルダ
	}
	ours := base
	theirs := []csvRow{
		row("index", "", "0"),
		row("F", "index", "1"),
		row("N", "F", "5"), // theirs がフォルダ F 配下に追加
	}

	merged, err := mergeRows(header, base, ours, theirs)
	if err != nil {
		t.Fatalf("mergeRows() error: %v", err)
	}

	n, ok := findRow(merged.Rows, "N")
	if !ok {
		t.Fatalf("theirs 追加ノード N が結果に含まれていない")
	}
	if n["parent_id"] != "F" {
		t.Errorf("N の parent_id = %q, want \"F\"（theirs の階層が維持されること）", n["parent_id"])
	}
	if n["seq"] != "5" {
		t.Errorf("N の seq = %q, want \"5\"（theirs の seq が維持されること）", n["seq"])
	}
}

// 双方が同じ行を変更した場合は ours が優先されること。
func TestMergeRowsBothChangedPrefersOurs(t *testing.T) {
	header := []string{"id", "parent_id", "seq", "name"}
	base := []csvRow{{"id": "A", "parent_id": "index", "seq": "1", "name": "base"}}
	ours := []csvRow{{"id": "A", "parent_id": "index", "seq": "1", "name": "ours"}}
	theirs := []csvRow{{"id": "A", "parent_id": "index", "seq": "1", "name": "theirs"}}

	merged, err := mergeRows(header, base, ours, theirs)
	if err != nil {
		t.Fatalf("mergeRows() error: %v", err)
	}
	a, _ := findRow(merged.Rows, "A")
	if a["name"] != "ours" {
		t.Errorf("name = %q, want \"ours\"", a["name"])
	}
}
