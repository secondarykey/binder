package fs_test

import (
	"errors"
	"path/filepath"
	"testing"

	"binder/api/json"
	"binder/fs"
)

// TestValidateAssetAlias はアセットの alias が公開先のパスとして使えるかの判定を検証する
func TestValidateAssetAlias(t *testing.T) {
	tests := []struct {
		alias string
		want  error
	}{
		// 従来の alias（docs/assets/{alias}）
		{"", nil},
		{"style.css", nil},
		{"my image (1).png", nil}, // ファイル名をそのまま使うことがあるため、空白・括弧は許す
		{"a..b.txt", nil},
		{".hidden", nil},
		{"a/b.txt", fs.ErrInvalidAlias},
		{`a\b.txt`, fs.ErrInvalidAlias},
		{"../x", fs.ErrInvalidAlias},
		{"..", fs.ErrInvalidAlias},
		{".", fs.ErrInvalidAlias},

		// サイトのルートに置く alias（docs/{alias}）
		{"/robots.txt", nil},
		{"/.nojekyll", nil},
		{"/CNAME", nil},
		{"/sitemap.xml", nil},
		{"/google0123abcd.html", nil},
		{"/", fs.ErrInvalidAlias},
		{"/a/b.txt", fs.ErrInvalidAlias},
		{"/.well-known/x", fs.ErrInvalidAlias},
		{"/my file.txt", fs.ErrInvalidAlias},
		{"/..", fs.ErrInvalidAlias},
		{"/.", fs.ErrInvalidAlias},
		{"/.git", fs.ErrInvalidAlias},
		{"/.gitignore", fs.ErrInvalidAlias},
		{"/index.html", fs.ErrReservedAlias},
		{"/404.html", fs.ErrReservedAlias},
		{"/pages", fs.ErrReservedAlias},
		{"/images", fs.ErrReservedAlias},
		{"/assets", fs.ErrReservedAlias},
		{"/layers", fs.ErrReservedAlias},
		{"/INDEX.HTML", fs.ErrReservedAlias}, // Windows では大文字小文字を区別しない
	}

	for _, tt := range tests {
		err := fs.ValidateAssetAlias(tt.alias)
		if tt.want == nil {
			if err != nil {
				t.Errorf("ValidateAssetAlias(%q) = %v, want nil", tt.alias, err)
			}
			continue
		}
		if !errors.Is(err, tt.want) {
			t.Errorf("ValidateAssetAlias(%q) = %v, want %v", tt.alias, err, tt.want)
		}
	}
}

// TestPublicAssetFileRoot は "/" で始まる alias が公開ディレクトリの直下になることを検証する
func TestPublicAssetFileRoot(t *testing.T) {
	tests := []struct {
		alias string
		want  string
	}{
		{"robots.txt", "docs/assets/robots.txt"},
		{"/robots.txt", "docs/robots.txt"},
		{"/.nojekyll", "docs/.nojekyll"},
		{"", ""},
	}
	for _, tt := range tests {
		got := filepath.ToSlash(fs.PublicAssetFile(&json.Asset{Alias: tt.alias}))
		if got != tt.want {
			t.Errorf("PublicAssetFile(%q) = %q, want %q", tt.alias, got, tt.want)
		}
	}
}
