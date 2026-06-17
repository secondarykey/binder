package binder_test

import (
	"binder/test"
	"os"
	"path/filepath"
	"testing"
)

func TestMain(m *testing.M) {
	//存在したら削除
	test.Clean()
	code := m.Run()
	os.Exit(code)
}

func TestLoad(t *testing.T) {
	b := test.CreateBinder(t, "load")
	defer b.Close()

	if b == nil {
		t.Fatal("CreateBinder returned nil")
	}

	dir := b.Dir()
	expected := filepath.Join(test.Dir, "load")
	if dir != expected {
		t.Errorf("Dir() = %q, want %q", dir, expected)
	}
}

func TestClose(t *testing.T) {
	b := test.CreateBinder(t, "close")
	err := b.Close()
	if err != nil {
		t.Errorf("Close() error: %v", err)
	}
}

func TestGenerate(t *testing.T) {
	t.Skip("TODO: requires HTTP server setup")
}

func TestCreateRemote(t *testing.T) {
	t.Skip("TODO: requires remote setup")
}
