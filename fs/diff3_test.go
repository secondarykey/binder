package fs

import (
	"strings"
	"testing"
)

// 片側のみの変更は競合なしで自動採用されること。
func TestMergeDiff3OneSideChange(t *testing.T) {
	base := "a\nb\nc\n"
	ours := "a\nB2\nc\n"   // ours が 2行目を変更
	theirs := "a\nb\nc\n"  // theirs は base のまま

	got, conflicted := mergeDiff3(base, ours, theirs)
	if conflicted {
		t.Errorf("競合扱いになった: %q", got)
	}
	if got != "a\nB2\nc\n" {
		t.Errorf("got %q, want ours の変更を採用", got)
	}
}

// 双方が別の箇所を変更した場合は両方とも自動マージされること。
func TestMergeDiff3NonOverlapping(t *testing.T) {
	base := "a\nb\nc\nd\n"
	ours := "A1\nb\nc\nd\n"   // 先頭を変更
	theirs := "a\nb\nc\nD4\n" // 末尾を変更

	got, conflicted := mergeDiff3(base, ours, theirs)
	if conflicted {
		t.Errorf("競合扱いになった: %q", got)
	}
	if got != "A1\nb\nc\nD4\n" {
		t.Errorf("got %q, want 両方の変更を統合", got)
	}
}

// 同じ箇所を双方が別内容に変更した場合は競合マーカーで両方残ること。
func TestMergeDiff3Conflict(t *testing.T) {
	base := "a\nb\nc\n"
	ours := "a\nOURS\nc\n"
	theirs := "a\nTHEIRS\nc\n"

	got, conflicted := mergeDiff3(base, ours, theirs)
	if !conflicted {
		t.Fatalf("競合が検出されなかった: %q", got)
	}
	if !strings.Contains(got, mergeMarkerOurs) ||
		!strings.Contains(got, mergeMarkerMiddle) ||
		!strings.Contains(got, mergeMarkerTheirs) {
		t.Errorf("マーカーが揃っていない: %q", got)
	}
	if !strings.Contains(got, "OURS") || !strings.Contains(got, "THEIRS") {
		t.Errorf("両方の内容が残っていない: %q", got)
	}
	// 共通部分は1度だけ
	if strings.Count(got, "a") < 1 || strings.Count(got, "\nc") < 1 {
		t.Errorf("共通行が欠けている: %q", got)
	}
}

// 双方が同一内容に変更した場合は競合せず1つにまとまること。
func TestMergeDiff3SameChange(t *testing.T) {
	base := "a\nb\nc\n"
	ours := "a\nSAME\nc\n"
	theirs := "a\nSAME\nc\n"

	got, conflicted := mergeDiff3(base, ours, theirs)
	if conflicted {
		t.Errorf("競合扱いになった: %q", got)
	}
	if got != "a\nSAME\nc\n" {
		t.Errorf("got %q, want 1つにまとまる", got)
	}
}
