package test

import (
	"binder"
	"log"
	"os"
	"path/filepath"
	"testing"
)

const (
	Dir = "testing_work"
)

func Clean() {
	defer os.Mkdir(Dir, 0666)
	_, err := os.Stat(Dir)
	if err != nil {
		return
	}

	remove(Dir)
}

func remove(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Println(err)
		return
	}

	for _, entry := range entries {

		i, err := entry.Info()
		if err != nil {
			log.Println(err)
			return
		}

		n := dir + "/" + i.Name()

		if i.IsDir() {
			remove(n)
		}
		os.Remove(n)
	}
}

func CreateBinder(t *testing.T, dir string) *binder.Binder {

	work := filepath.Join(Dir, dir)

	err := binder.Install(work)
	if err != nil {
		t.Fatalf("binder.Install error: %v", err)
	}

	b, err := binder.Load(work)
	if err != nil {
		t.Fatalf("binder.Load() error: %v", err)
	}

	err = b.Initialize("simple")
	if err != nil {
		t.Fatalf("binder.Initialize() error: %v", err)
	}

	return b
}
