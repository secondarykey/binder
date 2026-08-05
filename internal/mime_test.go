package internal_test

import (
	"testing"

	"binder/internal"
)

func TestMediaType(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"text/html", "text/html"},
		{"text/html; charset=utf-8", "text/html"},
		{"text/html;charset=UTF-8", "text/html"},
		{" Text/HTML ; charset=utf-8", "text/html"},
		{"image/svg+xml; charset=utf-8", "image/svg+xml"},
		{"", ""},
		// パースできない値でもメディアタイプ部分は判定に使う
		{"text/html; charset=", "text/html"},
		{"; charset=utf-8", ""},
	}
	for _, tt := range tests {
		if got := internal.MediaType(tt.in); got != tt.want {
			t.Errorf("MediaType(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

// 妥当な値は原文のまま保持し、MIMEとして成立しない値だけを落とす。
func TestSanitizeMime(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"そのまま保持", "text/html", "text/html"},
		{"パラメータも保持", "text/html; charset=utf-8", "text/html; charset=utf-8"},
		{"空白なしのパラメータも保持", "text/html;charset=utf-8", "text/html;charset=utf-8"},
		{"大文字も保持", "TEXT/HTML", "TEXT/HTML"},
		{"前後の空白のみ除去", "  text/css  ", "text/css"},
		{"壊れたパラメータは捨ててメディアタイプを残す", "text/html; charset", "text/html"},
		{"メディアタイプとして不正なら空", "html", ""},
		{"スラッシュのみは空", "/", ""},
		{"空文字は空", "", ""},
	}
	for _, tt := range tests {
		if got := internal.SanitizeMime(tt.in); got != tt.want {
			t.Errorf("%s: SanitizeMime(%q) = %q, want %q", tt.name, tt.in, got, tt.want)
		}
	}
}
