package fs_test

import (
	"binder/test"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	test.Clean()

	code := m.Run()
	os.Exit(code)
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
