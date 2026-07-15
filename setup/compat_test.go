package setup_test

import (
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/setup"
	"binder/setup/convert"
	"binder/test"

	"github.com/go-git/go-git/v5"
)

// newCompatBinder は指定バージョンの binder.json を持つ最小構成のバインダー
// （gitリポジトリ＋binder.json）を作成する。
func newCompatBinder(t *testing.T, name, version string) string {
	t.Helper()
	dir := filepath.Join(test.Dir, name)
	if _, err := git.PlainInit(dir, false); err != nil {
		t.Fatalf("git.PlainInit error: %v", err)
	}
	if err := fs.SaveMeta(dir, &fs.BinderMeta{Version: version}); err != nil {
		t.Fatalf("SaveMeta error: %v", err)
	}
	return dir
}

// TestCheckCompatBinderTooOld は最小サポートバージョン未満のバインダーが
// CompatBinderTooOld と判定されることを検証する。
func TestCheckCompatBinderTooOld(t *testing.T) {
	dir := newCompatBinder(t, "compat_too_old", "0.4.0")

	res, err := setup.CheckCompat(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("CheckCompat error: %v", err)
	}
	if res.Status != setup.CompatBinderTooOld {
		t.Errorf("Status = %v, want CompatBinderTooOld", res.Status)
	}
	if res.MinBinderVersion != convert.MinSupportedBinderVersion {
		t.Errorf("MinBinderVersion = %q, want %q", res.MinBinderVersion, convert.MinSupportedBinderVersion)
	}
	if res.BinderVersion != "0.4.0" {
		t.Errorf("BinderVersion = %q, want 0.4.0", res.BinderVersion)
	}
}

// TestCheckCompatNeedConvertAtMinSupported は最小サポートバージョン丁度の
// バインダーが移行可能（CompatNeedConvert）と判定されることを検証する。
func TestCheckCompatNeedConvertAtMinSupported(t *testing.T) {
	dir := newCompatBinder(t, "compat_min_supported", convert.MinSupportedBinderVersion)

	res, err := setup.CheckCompat(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("CheckCompat error: %v", err)
	}
	if res.Status != setup.CompatNeedConvert {
		t.Errorf("Status = %v, want CompatNeedConvert", res.Status)
	}
	if res.MinBinderVersion != "" {
		t.Errorf("MinBinderVersion = %q, want empty", res.MinBinderVersion)
	}
}

// TestCheckCompatOK はアプリと同一バージョンのバインダーが
// CompatOK と判定されることを検証する。
func TestCheckCompatOK(t *testing.T) {
	dir := newCompatBinder(t, "compat_ok", test.LatestVersion.String())

	res, err := setup.CheckCompat(dir, test.LatestVersion)
	if err != nil {
		t.Fatalf("CheckCompat error: %v", err)
	}
	if res.Status != setup.CompatOK {
		t.Errorf("Status = %v, want CompatOK", res.Status)
	}
}
