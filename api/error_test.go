package api

import (
	"encoding/json"
	"errors"
	"testing"

	"binder"
	"binder/db"
	"binder/fs"
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
		{"binderNotOpened", binder.EmptyError},
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

// バインダー未オープン時の GetConfig はエラーではなく null（設定なし）を返す。
// 起動時のエンジン先読みが LoadBinder 完了前に呼ぶことがあるため
func TestGetConfigWithoutBinder(t *testing.T) {
	a := &App{}
	conf, err := a.GetConfig()
	if err != nil {
		t.Errorf("GetConfig() without binder should not return error, got: %v", err)
	}
	if conf != nil {
		t.Errorf("GetConfig() without binder should return nil, got: %+v", conf)
	}
}

func TestUserErrorInfoKind(t *testing.T) {
	got := userError(fs.UpdatedFilesError)
	var me *MessageError
	if !errors.As(got, &me) {
		t.Fatal("UpdatedFilesError: result is not *MessageError")
	}
	if me.Kind != "info" {
		t.Errorf("UpdatedFilesError: expected kind=info, got %q", me.Kind)
	}
	if me.Body == "" {
		t.Error("UpdatedFilesError: body is empty")
	}
	if !errors.Is(got, fs.UpdatedFilesError) {
		t.Error("UpdatedFilesError: cause not preserved")
	}

	// MarshalJSON に kind が含まれることを確認
	b, err := json.Marshal(me)
	if err != nil {
		t.Fatalf("MarshalJSON error: %v", err)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(b, &payload); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if payload["kind"] != "info" {
		t.Errorf("MarshalJSON: expected kind=info in JSON, got %v", payload["kind"])
	}
}
