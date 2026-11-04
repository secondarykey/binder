package binder

import (
	"testing"

	"binder/api/json"
)

// TestExportAssetPath はエクスポートの zip 内のアセットのパスが、HTML 側の参照（./assets/x・./x）と揃うことを検証する
func TestExportAssetPath(t *testing.T) {
	tests := []struct {
		alias string
		want  string
	}{
		{"style.css", "assets/style.css"},
		{"/robots.txt", "robots.txt"},
		{"/.nojekyll", ".nojekyll"},
	}
	for _, tt := range tests {
		if got := exportAssetPath(&json.Asset{Alias: tt.alias}); got != tt.want {
			t.Errorf("exportAssetPath(%q) = %q, want %q", tt.alias, got, tt.want)
		}
	}
}
