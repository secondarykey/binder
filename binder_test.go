package binder_test

import (
	"binder"
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

func TestInstall(t *testing.T) {

	dir := filepath.Join(test.Dir, "create")
	err := binder.Install(dir)
	if err != nil {
		t.Fatalf("create error: %+v\n", err)
	}

	//データベース確認

	//テンプレート確認

}
