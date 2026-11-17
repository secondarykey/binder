package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
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

// 「別の Binder で開かれている」は、どのバインダーか（名前と場所）を出す
func TestUserErrorOpenedElsewhere(t *testing.T) {
	dir := t.TempDir()
	if err := fs.SaveMeta(dir, &fs.BinderMeta{Version: "0.0.0", Name: "技術メモ"}); err != nil {
		t.Fatal(err)
	}
	in := fmt.Errorf("binder.Load() error: %w", &fs.OpenedElsewhereError{Dir: dir})

	// 言語ファイルが古い（新しいキーが無い）ときは、これまでの文で出す。
	// 翻訳をまだ読んでいなければキーがそのまま返るので、その状態で確かめる
	var me *MessageError
	if settings.T("go.error.openedElsewhereNamed") == "go.error.openedElsewhereNamed" {
		got := userError(in)
		if !errors.As(got, &me) {
			t.Fatal("result is not *MessageError")
		}
		if me.Body != settings.T("go.error.openedElsewhere") || me.Detail != "" {
			t.Errorf("翻訳なし: body = %q, detail = %q", me.Body, me.Detail)
		}
	}

	// 翻訳があれば名前と場所を入れる（TestMain が home を一時ディレクトリへ向けている）
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
	if !strings.Contains(me.Body, "技術メモ") {
		t.Errorf("body = %q: バインダーの名前が入っていない", me.Body)
	}
	if !strings.Contains(me.Detail, dir) {
		t.Errorf("detail = %q: 場所が入っていない", me.Detail)
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

func TestBinderDisplayName(t *testing.T) {
	named := t.TempDir()
	if err := fs.SaveMeta(named, &fs.BinderMeta{Version: "0.0.0", Name: "技術メモ"}); err != nil {
		t.Fatal(err)
	}
	if got := binderDisplayName(named); got != "技術メモ" {
		t.Errorf("binderDisplayName(名前あり) = %q, want 技術メモ", got)
	}

	// 名前が無ければフォルダ名
	unnamed := filepath.Join(t.TempDir(), "notes-folder")
	if err := os.Mkdir(unnamed, 0755); err != nil {
		t.Fatal(err)
	}
	if got := binderDisplayName(unnamed); got != "notes-folder" {
		t.Errorf("binderDisplayName(binder.json なし) = %q, want notes-folder", got)
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
