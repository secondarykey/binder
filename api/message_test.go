package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"golang.org/x/xerrors"
)

func TestMarshalFindsMessageError(t *testing.T) {
	cause := errors.New("low level failure")
	me := WithDetail(cause, "ノートを削除できません", "子要素が存在します")

	b := MarshalError(me)
	if b == nil {
		t.Fatal("MarshalError returned nil for *MessageError")
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
	me := Wrap(nil, "ユーザ向けメッセージ")
	wrapped := fmt.Errorf("api layer: %w", me)

	b := MarshalError(wrapped)
	if b == nil {
		t.Fatal("MarshalError returned nil for wrapped *MessageError")
	}
	var got map[string]string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if got["body"] != "ユーザ向けメッセージ" {
		t.Errorf("body = %q, want %q", got["body"], "ユーザ向けメッセージ")
	}
}

func TestMarshalCauseIncludesStackTrace(t *testing.T) {
	// xerrors でラップした原因は %+v でスタック（file:line）を含むため、
	// cause が複数行になり、メッセージと位置情報の両方を持つこと。
	cause := xerrors.Errorf("boom at layer")
	me := Wrap(cause, "ユーザ向けメッセージ")

	b := MarshalError(me)
	var got map[string]string
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if !strings.Contains(got["cause"], "boom at layer") {
		t.Errorf("cause should contain the message, got %q", got["cause"])
	}
	if !strings.Contains(got["cause"], "\n") {
		t.Errorf("cause should contain a stack trace (multi-line), got %q", got["cause"])
	}
	if !strings.Contains(got["cause"], "message_test.go") {
		t.Errorf("cause should contain file:line of the stack, got %q", got["cause"])
	}
}

func TestMarshalReturnsNilForPlainError(t *testing.T) {
	if b := MarshalError(errors.New("plain")); b != nil {
		t.Errorf("MarshalError(plain) = %q, want nil", string(b))
	}
}

func TestMessageErrorAndUnwrap(t *testing.T) {
	cause := errors.New("root cause")
	me := Wrap(cause, "表示メッセージ")

	if me.Error() != "表示メッセージ" {
		t.Errorf("Error() = %q, want %q", me.Error(), "表示メッセージ")
	}
	if !errors.Is(me, cause) {
		t.Error("errors.Is(me, cause) = false, want true (Unwrap chain broken)")
	}

	// Body 空のときは Detail/Cause で補完
	empty := &MessageError{Cause: cause}
	if empty.Error() != "root cause" {
		t.Errorf("Error() fallback = %q, want %q", empty.Error(), "root cause")
	}
}
