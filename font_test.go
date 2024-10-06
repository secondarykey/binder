package binder_test

import (
	"binder"
	"testing"
)

func TestFontNames(t *testing.T) {
	names := binder.FontNames()
	if names[0] != "0xProto" {
		t.Errorf("font name error(not other terminal) : %s", names[0])
	}

	if names[2] != "Arial" {
		t.Errorf("font name error(not other terminal) : %s", names[2])
	}
}
