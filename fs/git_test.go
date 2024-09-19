package fs_test

import (
	"os"
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/test"

	uuid "github.com/google/uuid"
)

func TestAdd(t *testing.T) {

	dir := filepath.Join(test.Dir, "add")
	file := "test.txt"

	os.Mkdir(dir, 0666)

	//n, err := fs.NewBinder(dir)
	n, err := fs.NewMemory()
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

	branch := "pushTest"
	file := "test.txt"
	url := "https://github.com/secondarykey/secondarykey.github.com"

	n, err := fs.Clone(dir, url)
	if err != nil {
		t.Errorf("LoadBinder() error is not nil: %v", err)
	}

	//ブランチの切り替え
	err = n.Branch(branch)
	if err != nil {
		t.Errorf("Branch(binder) error is not nil: %v", err)
	}

	id := uuid.New()
	p := filepath.Join(dir, file)
	os.WriteFile(p, []byte(id.String()), 0644)

	n.Add(file)

	err = n.Commit("test : Commit", file)
	if err != nil {
		t.Errorf("Commit() error is not nil: %v", err)
	}
	n.PrintStatus()

	/*
		err = n.Push(branch)
		if err != nil {
			t.Errorf("Push() error is not nil: %v", err)
		}
	*/
}
