package test

import (
	"binder"
	"binder/db/model"
	"binder/log"
	"binder/settings"

	"os"
	"path/filepath"
	"testing"
)

const (
	Dir = "testing_work"
)

var LatestVersion *model.Version

func init() {
	LatestVersion = NewVer("0.1.0")
}

func NewVer(ver string) *model.Version {
	v, err := model.NewVersion(ver)
	if err != nil {
		panic(err)
	}
	return v
}

func Clean() {

	defer os.Mkdir(Dir, 0666)
	_, err := os.Stat(Dir)
	if err != nil {
		return
	}

	remove(Dir)

	set := settings.Get()
	auth := set.Git
	auth.Name = "Binder test"
	auth.Mail = "binder_test@localhost"
}

func remove(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return
	}

	for _, entry := range entries {

		i, err := entry.Info()
		if err != nil {
			log.PrintStackTrace(err)
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

	err := binder.Install(work, LatestVersion)
	if err != nil {
		t.Fatalf("binder.Install error: %v", err)
	}

	b, err := binder.Load(work, LatestVersion)
	if err != nil {
		t.Fatalf("binder.Load() error: %v", err)
	}

	err = b.Initialize("simple")
	if err != nil {
		t.Fatalf("binder.Initialize() error: %v", err)
	}

	return b
}
