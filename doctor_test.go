package binder_test

import (
	"binder"
	"binder/api/json"
	"binder/test"

	"os"
	"path/filepath"
	"testing"
)

// テスト用の db.Op 実装
type doctorTestOp struct{}

func (doctorTestOp) GetOperationId() string { return "doctor-test" }

// createDoctorNote はテスト用のノートを index 直下に作成して ID を返す。
func createDoctorNote(t *testing.T, b *binder.Binder, name string) string {
	t.Helper()
	n, err := b.EditNote(&json.Note{Name: name, ParentId: "index"}, "")
	if err != nil {
		t.Fatalf("EditNote() error: %v", err)
	}
	return n.Id
}

// structure 行はあるが実体ファイルが無いノートについて、doctor が空ファイルを
// 再作成し、開く・削除するが可能な状態に戻ることを検証する。
func TestDoctorRecreatesMissingNoteFile(t *testing.T) {
	const work = "doctor_missing_file"
	b := test.CreateBinder(t, work)
	defer b.Close()

	id := createDoctorNote(t, b, "doctor-target")

	mdPath := filepath.Join(test.Dir, work, "notes", id+".md")
	if err := os.Remove(mdPath); err != nil {
		t.Fatalf("os.Remove() error: %v", err)
	}

	rep, err := b.RunDoctor()
	if err != nil {
		t.Fatalf("RunDoctor() error: %v", err)
	}
	if len(rep.FilesRecreated) != 1 || rep.FilesRecreated[0].Id != id {
		t.Fatalf("FilesRecreated = %+v, want 1 entry for %s", rep.FilesRecreated, id)
	}

	if _, err := os.Stat(mdPath); err != nil {
		t.Fatalf("実体ファイルが再作成されていない: %v", err)
	}

	// 詰み解消の確認: ファイル欠損で失敗していた削除が可能になる
	if _, err := b.RemoveNote(id); err != nil {
		t.Errorf("doctor 後の RemoveNote() error: %v", err)
	}
}

// structure 行はあるが実体テーブル行が無いノートについて、doctor が最小行を
// 復元して GetNote が可能になることを検証する。
func TestDoctorRestoresMissingEntityRow(t *testing.T) {
	const work = "doctor_missing_row"
	b := test.CreateBinder(t, work)
	defer b.Close()

	id := createDoctorNote(t, b, "doctor-row")

	if err := b.GetDB().DeleteNote(id); err != nil {
		t.Fatalf("db.DeleteNote() error: %v", err)
	}
	if _, err := b.GetNote(id); err == nil {
		t.Fatal("実体行の削除が反映されていない")
	}

	rep, err := b.RunDoctor()
	if err != nil {
		t.Fatalf("RunDoctor() error: %v", err)
	}
	if len(rep.RowsRestored) != 1 || rep.RowsRestored[0].Id != id {
		t.Fatalf("RowsRestored = %+v, want 1 entry for %s", rep.RowsRestored, id)
	}

	if _, err := b.GetNote(id); err != nil {
		t.Errorf("doctor 後の GetNote() error: %v", err)
	}
}

// 親が存在しない structure 行が index 直下へ付け替えられることを検証する。
func TestDoctorReparentsDanglingParent(t *testing.T) {
	const work = "doctor_dangling"
	b := test.CreateBinder(t, work)
	defer b.Close()

	id := createDoctorNote(t, b, "doctor-dangling")

	m, err := b.GetDB().GetStructure(id)
	if err != nil {
		t.Fatalf("db.GetStructure() error: %v", err)
	}
	m.ParentId = "no-such-parent"
	if err := b.GetDB().UpdateStructure(m, doctorTestOp{}); err != nil {
		t.Fatalf("db.UpdateStructure() error: %v", err)
	}

	rep, err := b.RunDoctor()
	if err != nil {
		t.Fatalf("RunDoctor() error: %v", err)
	}
	if len(rep.Reparented) != 1 || rep.Reparented[0] != id {
		t.Fatalf("Reparented = %+v, want [%s]", rep.Reparented, id)
	}

	got, err := b.GetDB().GetStructure(id)
	if err != nil {
		t.Fatalf("修復後の db.GetStructure() error: %v", err)
	}
	if got.ParentId != "index" {
		t.Errorf("ParentId = %q, want \"index\"", got.ParentId)
	}
}

// structure 行を持たない実体ファイル（orphan）が行復元されることを検証する
// （ReconcileMergedTree と共用のロジックが doctor から動くことの確認）。
func TestDoctorRestoresOrphanFile(t *testing.T) {
	const work = "doctor_orphan"
	b := test.CreateBinder(t, work)
	defer b.Close()

	const orphanId = "doctor-orphan-0001"
	mdPath := filepath.Join(test.Dir, work, "notes", orphanId+".md")
	if err := os.WriteFile(mdPath, []byte("# orphan\n"), 0644); err != nil {
		t.Fatalf("os.WriteFile() error: %v", err)
	}

	rep, err := b.RunDoctor()
	if err != nil {
		t.Fatalf("RunDoctor() error: %v", err)
	}
	if len(rep.OrphanRestored) != 1 || rep.OrphanRestored[0].Id != orphanId {
		t.Fatalf("OrphanRestored = %+v, want 1 entry for %s", rep.OrphanRestored, orphanId)
	}

	s, err := b.GetStructure(orphanId)
	if err != nil {
		t.Fatalf("復元後 GetStructure() error: %v", err)
	}
	if s.ParentId != "index" {
		t.Errorf("ParentId = %q, want \"index\"", s.ParentId)
	}
}

// doctor を介さなくても、実体ファイルが欠損したままのノートを削除できることを
// 検証する（バインダーを開いている最中にズレが発生したケースの詰み防止）。
func TestRemoveNoteWithMissingFile(t *testing.T) {
	const work = "doctor_delete_lenient"
	b := test.CreateBinder(t, work)
	defer b.Close()

	id := createDoctorNote(t, b, "lenient-delete")

	mdPath := filepath.Join(test.Dir, work, "notes", id+".md")
	if err := os.Remove(mdPath); err != nil {
		t.Fatalf("os.Remove() error: %v", err)
	}

	if _, err := b.RemoveNote(id); err != nil {
		t.Fatalf("欠損ファイルのままの RemoveNote() error: %v", err)
	}
	if _, err := b.GetNote(id); err == nil {
		t.Error("削除後も GetNote() が成功している")
	}
}

// 整合の取れたバインダーでは doctor が何も修復しないことを検証する。
func TestDoctorCleanBinder(t *testing.T) {
	b := test.CreateBinder(t, "doctor_clean")
	defer b.Close()

	rep, err := b.RunDoctor()
	if err != nil {
		t.Fatalf("RunDoctor() error: %v", err)
	}
	if rep.Repaired() {
		t.Errorf("整合の取れたバインダーで修復が発生した: %s", rep.Summary())
	}
}

// Load() 時に doctor が自動実行されることを検証する。
func TestDoctorRunsOnLoad(t *testing.T) {
	const work = "doctor_on_load"
	b := test.CreateBinder(t, work)

	id := createDoctorNote(t, b, "doctor-on-load")

	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}

	mdPath := filepath.Join(test.Dir, work, "notes", id+".md")
	if err := os.Remove(mdPath); err != nil {
		t.Fatalf("os.Remove() error: %v", err)
	}

	b2, err := binder.Load(filepath.Join(test.Dir, work))
	if err != nil {
		t.Fatalf("binder.Load() error: %v", err)
	}
	defer b2.Close()

	if _, err := os.Stat(mdPath); err != nil {
		t.Errorf("Load 時に実体ファイルが再作成されていない: %v", err)
	}
}
