package msgerr_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"binder/msgerr"
)

func TestMarshalFindsMessageError(t *testing.T) {
	cause := errors.New("low level failure")
	me := msgerr.WithDetail(cause, "ノートを削除できません", "子要素が存在します")

	b := msgerr.Marshal(me)
	if b == nil {
		t.Fatal("Marshal returned nil for *MessageError")
	}

	var got map[string]string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if got["body"] != "ノートを削除できません" {
		t.Errorf("body = %q, want %q", got["body"], "ノートを削除できません")
	}
	if got["detail"] != "子要素が存在します" {
		t.Errorf("detail = %q, want %q", got["detail"], "子要素が存在します")
	}
	if got["cause"] != "low level failure" {
		t.Errorf("cause = %q, want %q", got["cause"], "low level failure")
	}
}

func TestMarshalUnwrapsThroughChain(t *testing.T) {
	// MessageError がさらに別の error でラップされていても errors.As で拾えること
	me := msgerr.New("ユーザ向けメッセージ")
	wrapped := fmt.Errorf("api layer: %w", me)

	b := msgerr.Marshal(wrapped)
	if b == nil {
		t.Fatal("Marshal returned nil for wrapped *MessageError")
	}
	var got map[string]string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if got["body"] != "ユーザ向けメッセージ" {
		t.Errorf("body = %q, want %q", got["body"], "ユーザ向けメッセージ")
	}
}

func TestMarshalReturnsNilForPlainError(t *testing.T) {
	if b := msgerr.Marshal(errors.New("plain")); b != nil {
		t.Errorf("Marshal(plain) = %q, want nil", string(b))
	}
}

func TestErrorAndUnwrap(t *testing.T) {
	cause := errors.New("root cause")
	me := msgerr.Wrap(cause, "表示メッセージ")

	if me.Error() != "表示メッセージ" {
		t.Errorf("Error() = %q, want %q", me.Error(), "表示メッセージ")
	}
	if !errors.Is(me, cause) {
		t.Error("errors.Is(me, cause) = false, want true (Unwrap chain broken)")
	}

	// Body 空のときは Detail/Cause で補完
	empty := &msgerr.MessageError{Cause: cause}
	if empty.Error() != "root cause" {
		t.Errorf("Error() fallback = %q, want %q", empty.Error(), "root cause")
	}
}
