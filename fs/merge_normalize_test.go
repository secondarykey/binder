package fs

import "testing"

// 親が削除されて dangling になったノードが index 直下へ救済されること。
// 救済ノード配下の子は元の親（救済ノード）を維持すること。
func TestRepairDanglingParents(t *testing.T) {
	rows := []csvRow{
		row("index", "", "0"),
		row("A", "GONE", "3"), // 親 GONE が存在しない → dangling
		row("B", "A", "1"),    // 救済される A の子（維持されるべき）
		row("C", "index", "2"),
	}

	reparented := repairDanglingParents(rows)

	if len(reparented) != 1 || reparented[0].Id != "A" {
		t.Fatalf("reparented = %+v, want [A]", reparented)
	}

	a, _ := findRow(rows, "A")
	if a["parent_id"] != structureRootId {
		t.Errorf("A の parent_id = %q, want %q", a["parent_id"], structureRootId)
	}
	// index 直下の既存 seq 最大値は C の 2 なので 3 が採番される
	if a["seq"] != "3" {
		t.Errorf("A の seq = %q, want \"3\"（index 直下の末尾）", a["seq"])
	}

	b, _ := findRow(rows, "B")
	if b["parent_id"] != "A" {
		t.Errorf("B の parent_id = %q, want \"A\"（救済ノード配下を維持）", b["parent_id"])
	}
}

// dangling が無い場合は何も変更しないこと。
func TestRepairDanglingParentsNoChange(t *testing.T) {
	rows := []csvRow{
		row("index", "", "0"),
		row("A", "index", "1"),
		row("B", "A", "1"),
	}
	reparented := repairDanglingParents(rows)
	if len(reparented) != 0 {
		t.Fatalf("reparented = %+v, want empty", reparented)
	}
	a, _ := findRow(rows, "A")
	if a["parent_id"] != "index" {
		t.Errorf("A の parent_id が変更された: %q", a["parent_id"])
	}
}

// 複数の dangling ノードが index 直下で連番採番されること。
func TestRepairDanglingParentsMultiple(t *testing.T) {
	rows := []csvRow{
		row("index", "", "0"),
		row("X", "GONE1", "9"),
		row("Y", "GONE2", "9"),
	}
	reparented := repairDanglingParents(rows)
	if len(reparented) != 2 {
		t.Fatalf("reparented count = %d, want 2", len(reparented))
	}
	x, _ := findRow(rows, "X")
	y, _ := findRow(rows, "Y")
	if x["parent_id"] != structureRootId || y["parent_id"] != structureRootId {
		t.Errorf("X/Y が index 直下になっていない: X=%q Y=%q", x["parent_id"], y["parent_id"])
	}
	// index 直下に既存 seq が無いので 1,2 が採番される
	if x["seq"] == y["seq"] {
		t.Errorf("救済ノードの seq が重複している: X=%q Y=%q", x["seq"], y["seq"])
	}
}
