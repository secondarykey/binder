package test_test

import (
	"binder/test"
	"os"
	"path/filepath"

	"testing"
)

func TestClean(t *testing.T) {
	os.Mkdir(test.Dir, 0666)
	f := filepath.Join(test.Dir, "test.txt")
	fp, err := os.Create(f)
	if err != nil {
		t.Errorf("[%s] create error", f)
		return
	}

	_, err = fp.Write([]byte("test Text"))
	if err != nil {
		t.Errorf("[%s] write error", f)
		return
	}
	err = fp.Close()
	if err != nil {
		t.Errorf("[%s] close error", f)
		return
	}

	test.Clean()

	_, err = os.Stat(f)
	if err == nil {
		t.Errorf("[%s] is exists", f)
	}
}
