package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"binder"
	"binder/db"
	"binder/fs"
	"binder/settings"
	"binder/setup"
	"binder/setup/defaults"
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
		{"keyringUnavailable", setup.ErrKeyringUnavailable},
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

// 「別の Binder で開かれている」は、どのバインダーか（バインダー一覧と同じパス）を出す
func TestUserErrorOpenedElsewhere(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "技術メモ")
	in := fmt.Errorf("binder.Load() error: %w", &fs.OpenedElsewhereError{Dir: dir})

	// 言語ファイルが古い（新しいキーが無い）ときは、これまでの文で出す。
	// 翻訳をまだ読んでいなければキーがそのまま返るので、その状態で確かめる
	var me *MessageError
	if settings.T("go.error.openedElsewhereAt") == "go.error.openedElsewhereAt" {
		got := userError(in)
		if !errors.As(got, &me) {
			t.Fatal("result is not *MessageError")
		}
		if me.Body != settings.T("go.error.openedElsewhere") {
			t.Errorf("翻訳なし: body = %q", me.Body)
		}
	}

	// 翻訳があればパスを入れる（TestMain が home を一時ディレクトリへ向けている）
	if err := defaults.InstallLanguages(true); err != nil {
		t.Fatal(err)
	}
	if err := settings.InitI18n("ja"); err != nil {
		t.Fatal(err)
	}
	got := userError(in)
	if !errors.As(got, &me) {
		t.Fatal("result is not *MessageError")
	}
	if !strings.Contains(me.Body, dir) {
		t.Errorf("body = %q: バインダーのパスが入っていない", me.Body)
	}
	if !errors.Is(got, fs.ErrOpenedElsewhere) {
		t.Error("errors.Is chain broken")
	}

	// 場所を持たない形（sentinel だけ）は、これまでの文で出す
	old := userError(fs.ErrOpenedElsewhere)
	if !errors.As(old, &me) || me.Body != settings.T("go.error.openedElsewhere") {
		t.Errorf("sentinel only: %v", old)
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
