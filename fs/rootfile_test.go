package fs_test

import (
	"testing"

	"binder/fs"
)

func TestValidateRootFileName(t *testing.T) {
	valid := []string{"README.md", "LICENSE", "note-memo.txt", "a_b.c"}
	for _, name := range valid {
		if err := fs.ValidateRootFileName(name); err != nil {
			t.Errorf("ValidateRootFileName(%q) = %v, want nil", name, err)
		}
	}

	invalid := []string{
		"",
		".gitignore",
		".hidden",
		"binder.json",
		"Binder.JSON", // 大文字小文字を区別しない
		"notes",
		"docs",
		"db",
		"user_data.enc",
		"../escape.md",
		"dir/file.md",
		"dir\\file.md",
	}
	for _, name := range invalid {
		if err := fs.ValidateRootFileName(name); err == nil {
			t.Errorf("ValidateRootFileName(%q) = nil, want error", name)
		}
	}
}

func TestRootFileCRUD(t *testing.T) {
	f := createFileSystem(t, "rootfile_crud")

	// 作成
	if _, err := f.WriteRootFile("README.md", []byte("# Hello")); err != nil {
		t.Fatalf("WriteRootFile() error: %v", err)
	}

	// 読み込み
	content, err := f.ReadRootFile("README.md")
	if err != nil {
		t.Fatalf("ReadRootFile() error: %v", err)
	}
	if content != "# Hello" {
		t.Errorf("ReadRootFile() = %q, want %q", content, "# Hello")
	}

	// 一覧
	list, err := f.ListRootFiles()
	if err != nil {
		t.Fatalf("ListRootFiles() error: %v", err)
	}
	found := false
	for _, info := range list {
		if info.Name == "README.md" {
			found = true
		}
	}
	if !found {
		t.Errorf("ListRootFiles() does not contain README.md: %+v", list)
	}

	// リネーム
	if _, err := f.RenameRootFile("README.md", "NOTICE.md"); err != nil {
		t.Fatalf("RenameRootFile() error: %v", err)
	}
	if _, err := f.ReadRootFile("README.md"); err == nil {
		t.Error("ReadRootFile(README.md) should fail after rename")
	}
	content, err = f.ReadRootFile("NOTICE.md")
	if err != nil {
		t.Fatalf("ReadRootFile(NOTICE.md) error: %v", err)
	}
	if content != "# Hello" {
		t.Errorf("ReadRootFile() after rename = %q, want %q", content, "# Hello")
	}

	// 削除
	if _, err := f.DeleteRootFile("NOTICE.md"); err != nil {
		t.Fatalf("DeleteRootFile() error: %v", err)
	}
	if _, err := f.ReadRootFile("NOTICE.md"); err == nil {
		t.Error("ReadRootFile(NOTICE.md) should fail after delete")
	}
}

func TestListRootFilesExcludesReserved(t *testing.T) {
	f := createFileSystem(t, "rootfile_list")

	if _, err := f.WriteRootFile("README.md", []byte("test")); err != nil {
		t.Fatalf("WriteRootFile() error: %v", err)
	}

	list, err := f.ListRootFiles()
	if err != nil {
		t.Fatalf("ListRootFiles() error: %v", err)
	}
	for _, info := range list {
		if info.Name == "binder.json" || info.Name == ".gitignore" {
			t.Errorf("ListRootFiles() should exclude reserved file: %s", info.Name)
		}
	}
}
