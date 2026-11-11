package settings_test

import (
	"binder/settings"
	"testing"
)

func TestFontNames(t *testing.T) {
	names := settings.FontNames()
	if names[0] != "0xProto" {
		t.Errorf("font name error(not other terminal) : %s", names[0])
	}

	if names[2] != "Arial" {
		t.Errorf("font name error(not other terminal) : %s", names[2])
	}
}
