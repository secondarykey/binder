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
// Go テストはそれを呼んだパッケージのディレクトリで実行される（ルートのテストならルート、
// test/ のテストなら test/）ので、作業ディレクトリから上へたどって探す。
// 「..」固定だとルートのテストから読めず、0.0.0 のバインダーを作ってしまう
// （0.0.0 は取り込み元として古すぎる扱いになり、取り込みのテストができない）。
func readConfigVersion() string {
	data, err := readUpward(filepath.Join("_cmd", "binder", "build", "config.yml"))
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

// readUpward は作業ディレクトリから上へたどり、最初に見つかった rel を読む。
func readUpward(rel string) ([]byte, error) {
	dir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	for {
		data, err := os.ReadFile(filepath.Join(dir, rel))
		if err == nil {
			return data, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return nil, err
		}
		dir = parent
	}
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

	err := setup.Install(work, LatestVersion, "simple", "")
	if err != nil {
		t.Fatalf("setup.Install error: %v", err)
	}

	b, err := binder.Load(work)
	if err != nil {
		t.Fatalf("binder.Load() error: %v", err)
	}

	return b
}
