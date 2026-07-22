package settings

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// setTestHome は Home() が返すディレクトリをテスト用に差し替える。
func setTestHome(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
}

func TestCreateLiteWorkAssignsUnusedNames(t *testing.T) {
	setTestHome(t)

	first, err := CreateLiteWork()
	if err != nil {
		t.Fatalf("CreateLiteWork() error: %v", err)
	}
	if first != "Untitled" {
		t.Errorf("first work name = %q, want %q", first, "Untitled")
	}

	second, err := CreateLiteWork()
	if err != nil {
		t.Fatalf("CreateLiteWork() error: %v", err)
	}
	if second != "Untitled-2" {
		t.Errorf("second work name = %q, want %q", second, "Untitled-2")
	}

	// 既存のワークを消すと、その番号が再利用される
	if err := DeleteLiteWork(first); err != nil {
		t.Fatalf("DeleteLiteWork() error: %v", err)
	}
	third, err := CreateLiteWork()
	if err != nil {
		t.Fatalf("CreateLiteWork() error: %v", err)
	}
	if third != "Untitled" {
		t.Errorf("third work name = %q, want %q", third, "Untitled")
	}
}

func TestListLiteWorksOrderAndContent(t *testing.T) {
	setTestHome(t)

	if works, err := ListLiteWorks(); err != nil || len(works) != 0 {
		t.Fatalf("ListLiteWorks() on empty = %v, %v; want empty, nil", works, err)
	}

	for i := 0; i < 3; i++ {
		if _, err := CreateLiteWork(); err != nil {
			t.Fatalf("CreateLiteWork() error: %v", err)
		}
	}
	if err := SaveLiteWork("Untitled-3", "# third"); err != nil {
		t.Fatalf("SaveLiteWork() error: %v", err)
	}

	works, err := ListLiteWorks()
	if err != nil {
		t.Fatalf("ListLiteWorks() error: %v", err)
	}
	want := []string{"Untitled", "Untitled-2", "Untitled-3"}
	if len(works) != len(want) {
		t.Fatalf("ListLiteWorks() len = %d, want %d", len(works), len(want))
	}
	for i, w := range works {
		if w.Name != want[i] {
			t.Errorf("works[%d].Name = %q, want %q", i, w.Name, want[i])
		}
	}
	if works[2].Content != "# third" {
		t.Errorf("works[2].Content = %q, want %q", works[2].Content, "# third")
	}
}

func TestLiteWorkRejectsInvalidNames(t *testing.T) {
	setTestHome(t)

	for _, name := range []string{"", "../evil", "Untitled/../x", "Other", "Untitled-0", "Untitled-2.md"} {
		if err := SaveLiteWork(name, "x"); err == nil {
			t.Errorf("SaveLiteWork(%q) = nil, want error", name)
		}
		if err := DeleteLiteWork(name); err == nil {
			t.Errorf("DeleteLiteWork(%q) = nil, want error", name)
		}
	}
}

func TestDeleteLiteWorkMissingIsNoop(t *testing.T) {
	setTestHome(t)

	if err := DeleteLiteWork("Untitled-5"); err != nil {
		t.Errorf("DeleteLiteWork() on missing file error: %v", err)
	}
}

func TestSaveLiteWorkCreatesDir(t *testing.T) {
	setTestHome(t)

	if err := SaveLiteWork("Untitled", "hello"); err != nil {
		t.Fatalf("SaveLiteWork() error: %v", err)
	}
	p := filepath.Join(LiteWorkDirPath(), "Untitled.md")
	data, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("os.ReadFile(%s) error: %v", p, err)
	}
	if string(data) != "hello" {
		t.Errorf("content = %q, want %q", string(data), "hello")
	}
}
