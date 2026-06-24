package api

import (
	"errors"
	"testing"

	"binder"
	"binder/db"
)

func TestUserErrorMapsSentinels(t *testing.T) {
	cases := []struct {
		name string
		in   error
	}{
		{"noteHasChildren", binder.ErrNoteHasChildren},
		{"indexNote", binder.ErrIndexNoteUndeletable},
		{"assetHasLayers", binder.ErrAssetHasLayers},
		{"duplicateAlias", db.DuplicateAlias},
		{"duplicateKey", db.DuplicateKey},
		{"uncommitted", ErrUncommittedChanges},
	}
	for _, c := range cases {
		got := userError(c.in)
		var me *MessageError
		if !errors.As(got, &me) {
			t.Errorf("%s: result is not *MessageError", c.name)
			continue
		}
		if me.Body == "" {
			t.Errorf("%s: body is empty", c.name)
		}
		if !errors.Is(got, c.in) {
			t.Errorf("%s: errors.Is chain broken (Cause not preserved)", c.name)
		}
	}

	// nil はそのまま nil
	if userError(nil) != nil {
		t.Error("userError(nil) should return nil")
	}

	// 未知のエラーは汎用メッセージで包むが Cause は保持する
	unknown := errors.New("boom")
	got := userError(unknown)
	var me *MessageError
	if !errors.As(got, &me) {
		t.Fatal("unknown error: result is not *MessageError")
	}
	if me.Body == "" {
		t.Error("unknown error: generic body is empty")
	}
	if !errors.Is(got, unknown) {
		t.Error("unknown error: cause not preserved")
	}
}
