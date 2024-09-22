package fs_test

import (
	"binder/fs"
	"binder/test"
	"os"
	"path/filepath"
	"testing"
)

func TestMain(m *testing.M) {
	test.Clean()

	code := m.Run()
	os.Exit(code)
}

func createFileSystem(t *testing.T, dir string) *fs.FileSystem {

	work := filepath.Join(test.Dir, dir)
	f, err := fs.New(work)
	if err != nil {
		t.Fatalf("createFileSystem() error: %v", err)
	}
	return f
}

func TestNew(t *testing.T) {
}

func TestNewMemory(t *testing.T) {
}

func TestLoad(t *testing.T) {
}

func TestCreate(t *testing.T) {
}

func TestRemove(t *testing.T) {
}
