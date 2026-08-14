package binder

import (
	"testing"

	"binder/internal"
)

// data URI にはパラメータを残してよいが、空白は URI 中に置けない。
func TestCleanDataURIMime(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"image/png", "image/png"},
		{"text/plain; charset=utf-8", "text/plain;charset=utf-8"},
		{" text/html ; charset=utf-8 ", "text/html;charset=utf-8"},
	}
	for _, tt := range tests {
		if got := cleanDataURIMime(tt.in); got != tt.want {
			t.Errorf("cleanDataURIMime(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

// detectMime は環境によってパラメータ付きを返しうるが、
// メディアタイプは常に期待どおりであることを保証する（値自体は加工しない）。
func TestDetectMimeMediaType(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"a.html", "text/html"},
		{"a.htm", "text/html"},
		{"a.css", "text/css"},
		{"a.svg", "image/svg+xml"},
		{"a.png", "image/png"},
	}
	for _, tt := range tests {
		got := detectMime(tt.name, false)
		if mt := internal.MediaType(got); mt != tt.want {
			t.Errorf("detectMime(%q) = %q (media type %q), want media type %q", tt.name, got, mt, tt.want)
		}
	}
	if got := detectMime("noext", true); got != "application/octet-stream" {
		t.Errorf("detectMime(noext, binary) = %q, want application/octet-stream", got)
	}
}
