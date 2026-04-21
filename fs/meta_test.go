package fs_test

import (
	"os"
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/test"
)

func mkDir(t *testing.T, dir string) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("MkdirAll(%s) error: %v", dir, err)
	}
	return dir
}

func TestLoadMeta_NotExist(t *testing.T) {
	dir := filepath.Join(test.Dir, "meta_notexist")
	meta, err := fs.LoadMeta(dir)
	if err != nil {
		t.Fatalf("LoadMeta() expected nil error for missing file, got: %v", err)
	}
	if meta != nil {
		t.Errorf("LoadMeta() expected nil meta for missing file, got: %+v", meta)
	}
}

func TestSaveAndLoadMeta(t *testing.T) {
	dir := mkDir(t, filepath.Join(test.Dir, "meta_save"))

	original := &fs.BinderMeta{
		Version: "1.2.3",
		Name:    "TestBinder",
		Detail:  "detail text",
	}

	if err := fs.SaveMeta(dir, original); err != nil {
		t.Fatalf("SaveMeta() error: %v", err)
	}

	loaded, err := fs.LoadMeta(dir)
	if err != nil {
		t.Fatalf("LoadMeta() error: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadMeta() returned nil")
	}
	if loaded.Version != original.Version {
		t.Errorf("Version: got %q, want %q", loaded.Version, original.Version)
	}
	if loaded.Name != original.Name {
		t.Errorf("Name: got %q, want %q", loaded.Name, original.Name)
	}
	if loaded.Detail != original.Detail {
		t.Errorf("Detail: got %q, want %q", loaded.Detail, original.Detail)
	}
}

func TestSaveMetaOverwrite(t *testing.T) {
	dir := mkDir(t, filepath.Join(test.Dir, "meta_overwrite"))

	first := &fs.BinderMeta{Version: "0.1.0", Name: "First"}
	if err := fs.SaveMeta(dir, first); err != nil {
		t.Fatalf("SaveMeta() first error: %v", err)
	}

	second := &fs.BinderMeta{Version: "0.2.0", Name: "Second"}
	if err := fs.SaveMeta(dir, second); err != nil {
		t.Fatalf("SaveMeta() second error: %v", err)
	}

	loaded, err := fs.LoadMeta(dir)
	if err != nil {
		t.Fatalf("LoadMeta() error: %v", err)
	}
	if loaded.Version != "0.2.0" {
		t.Errorf("Version: got %q, want %q", loaded.Version, "0.2.0")
	}
}

func TestLoadMetaDataAndSaveMetaData(t *testing.T) {
	f := createFileSystem(t, "meta_fs")

	// 存在しない場合は nil を返す
	meta, err := f.LoadMetaData()
	if err != nil {
		t.Fatalf("LoadMetaData() unexpected error: %v", err)
	}
	if meta != nil {
		t.Errorf("LoadMetaData() expected nil for missing file, got: %+v", meta)
	}

	original := &fs.BinderMeta{
		Version: "2.0.0",
		Name:    "FSBinder",
		Detail:  "fs detail",
	}
	if err := f.SaveMetaData(original); err != nil {
		t.Fatalf("SaveMetaData() error: %v", err)
	}

	loaded, err := f.LoadMetaData()
	if err != nil {
		t.Fatalf("LoadMetaData() error after save: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadMetaData() returned nil after save")
	}
	if loaded.Version != original.Version {
		t.Errorf("Version: got %q, want %q", loaded.Version, original.Version)
	}
	if loaded.Name != original.Name {
		t.Errorf("Name: got %q, want %q", loaded.Name, original.Name)
	}
}
