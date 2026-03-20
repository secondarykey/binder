package test

import (
	. "binder/internal"

	"binder"
	"binder/log"
	"binder/settings"
	"binder/setup"

	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	Dir = "testing_work"
)

var LatestVersion *Version

func init() {
	LatestVersion = NewVer(readConfigVersion())
}

// readConfigVersion は _cmd/binder/build/config.yml からアプリバージョンを読み出す。
// Go テストはパッケージディレクトリ (test/) から実行されるため、相対パスで参照できる。
func readConfigVersion() string {
	p := filepath.Join("..", "_cmd", "binder", "build", "config.yml")
	data, err := os.ReadFile(p)
	if err != nil {
		return "0.0.0"
	}
	const key = `version: "`
	s := string(data)
	idx := strings.Index(s, key)
	if idx < 0 {
		return "0.0.0"
	}
	s = s[idx+len(key):]
	end := strings.Index(s, `"`)
	if end < 0 {
		return "0.0.0"
	}
	return s[:end]
}

func NewVer(ver string) *Version {
	v, err := NewVersion(ver)
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

	err := setup.Install(work, LatestVersion)
	if err != nil {
		t.Fatalf("setup.Install error: %v", err)
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
