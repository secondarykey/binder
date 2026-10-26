package settings

import "testing"

func TestTrustedBinder(t *testing.T) {
	setPVHome(t)

	// 既定では信頼しない
	if IsTrustedBinder("/binderA") {
		t.Fatal("IsTrustedBinder() = true, want false by default")
	}

	if err := SetTrustedBinder("/binderA", true); err != nil {
		t.Fatalf("SetTrustedBinder() error: %v", err)
	}
	// 二度入れても重複しない
	if err := SetTrustedBinder("/binderA", true); err != nil {
		t.Fatalf("SetTrustedBinder() error: %v", err)
	}
	if !IsTrustedBinder("/binderA") {
		t.Error("IsTrustedBinder(/binderA) = false, want true")
	}
	if IsTrustedBinder("/binderB") {
		t.Error("IsTrustedBinder(/binderB) = true, want false")
	}
	if got := len(Get().TrustedBinders); got != 1 {
		t.Errorf("TrustedBinders has %d entries, want 1", got)
	}

	// 保存した内容を読み直しても残る
	pSet = nil
	if !IsTrustedBinder("/binderA") {
		t.Error("IsTrustedBinder(/binderA) after reload = false, want true")
	}

	if err := SetTrustedBinder("/binderA", false); err != nil {
		t.Fatalf("SetTrustedBinder() error: %v", err)
	}
	if IsTrustedBinder("/binderA") {
		t.Error("IsTrustedBinder(/binderA) = true after untrust, want false")
	}

	// 空のパスは信頼しない
	if err := SetTrustedBinder("", true); err != nil {
		t.Fatalf("SetTrustedBinder(\"\") error: %v", err)
	}
	if IsTrustedBinder("") {
		t.Error("IsTrustedBinder(\"\") = true, want false")
	}
}
