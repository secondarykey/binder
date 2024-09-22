package binder_test

import (
	"binder/test"
	"os"

	"testing"
)

func TestMain(m *testing.M) {
	//存在したら削除
	test.Clean()
	code := m.Run()
	os.Exit(code)
}

func TestLoad(t *testing.T) {
}

func TestClose(t *testing.T) {
}

func TestGenerate(t *testing.T) {
}

func TestCreateRemote(t *testing.T) {
}
