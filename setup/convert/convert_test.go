package convert

import (
	"strings"
	"testing"

	. "binder/internal"

	"binder/fs"
)

func mustVersion(t *testing.T, s string) *Version {
	t.Helper()
	v, err := NewVersion(s)
	if err != nil {
		t.Fatalf("NewVersion(%s) error: %v", s, err)
	}
	return v
}

// TestNeedsMigration は移行要否判定の境界を検証する。
func TestNeedsMigration(t *testing.T) {
	cases := []struct {
		ver  string
		want bool
	}{
		{"0.4.8", true},  // 0.7.2 以降の移行が必要
		{"0.7.2", true},  // 0.9.2 以降の移行が必要
		{"0.10.1", true}, // 0.10.2 の移行が必要
		{"0.10.2", false},
		{"0.13.0", false},
	}
	for _, c := range cases {
		if got := NeedsMigration(mustVersion(t, c.ver)); got != c.want {
			t.Errorf("NeedsMigration(%s) = %v, want %v", c.ver, got, c.want)
		}
	}
}

// TestMinSupportedBinderVersion は最小サポートバージョンの整合性を検証する。
// 移行リストの全エントリが最小サポートバージョン以降であること
// （＝最小サポートバージョンのバインダーに必要な移行が欠けていないこと）を保証する。
func TestMinSupportedBinderVersion(t *testing.T) {
	minVer := mustVersion(t, MinSupportedBinderVersion)
	for _, m := range migrations {
		if m.ver.Lt(minVer) {
			t.Errorf("migration %s is older than MinSupportedBinderVersion %s", m.ver.String(), MinSupportedBinderVersion)
		}
	}
}

// TestRunRejectsUnsupportedBinder は最小サポートバージョン未満のバインダーで
// Run() が移行を開始せずエラーを返すことを検証する。
func TestRunRejectsUnsupportedBinder(t *testing.T) {
	dir := t.TempDir()
	if err := fs.SaveMeta(dir, &fs.BinderMeta{Version: "0.4.0"}); err != nil {
		t.Fatalf("SaveMeta error: %v", err)
	}

	_, err := Run(dir, mustVersion(t, "0.13.0"))
	if err == nil {
		t.Fatal("Run() should reject binder older than MinSupportedBinderVersion")
	}
	if !strings.Contains(err.Error(), "minimum supported") {
		t.Errorf("unexpected error: %v", err)
	}
}

// TestRunAcceptsMinSupportedBinder は最小サポートバージョン丁度のバインダーが
// ガードで拒否されないことを検証する（gitリポジトリではないため後続処理では失敗する）。
func TestRunAcceptsMinSupportedBinder(t *testing.T) {
	dir := t.TempDir()
	if err := fs.SaveMeta(dir, &fs.BinderMeta{Version: MinSupportedBinderVersion}); err != nil {
		t.Fatalf("SaveMeta error: %v", err)
	}

	_, err := Run(dir, mustVersion(t, "0.13.0"))
	if err != nil && strings.Contains(err.Error(), "minimum supported") {
		t.Errorf("Run() should not reject binder at MinSupportedBinderVersion: %v", err)
	}
}
