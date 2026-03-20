package setup_test

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
