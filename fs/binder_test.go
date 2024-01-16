package fs_test

import (
	"os"
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/test"
)

func TestMain(m *testing.M) {
	test.Clean()
	code := m.Run()
	os.Exit(code)
}

func TestAdd(t *testing.T) {

	dir := filepath.Join(test.Dir, "add")
	file := "test.txt"

	os.Mkdir(dir, 0666)

	//n, err := fs.NewBinder(dir)
	n, err := fs.NewMemoryBinder()
	if err != nil {
		t.Errorf("NewBinder() error is not nil: %v", err)
	}

	p := filepath.Join(dir, file)
	os.WriteFile(p, []byte("test"), 0644)

	n.Add(file)
	n.PrintStatus()

}

func TestClone(t *testing.T) {

	dir := filepath.Join(test.Dir, "remote")

	file := "test.txt"
	url := "https://github.com/secondarykey/secondarykey.github.com"

	n, err := fs.CloneBinder(dir, url)
	if err != nil {
		t.Errorf("LoadBinder() error is not nil: %v", err)
	}

	p := filepath.Join(dir, file)
	os.WriteFile(p, []byte("test"), 0644)

	n.Add(file)

	n.PrintStatus()
}

func TestCreate(t *testing.T) {

	dir := filepath.Join(test.Dir, "create")

	b, err := fs.Create(dir)
	if err != nil {
		t.Errorf("Create() error is not nil: %v", err)
	}
	b.PrintStatus()
}
