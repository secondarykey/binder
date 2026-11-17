package setup

import (
	"errors"
	"testing"

	"github.com/zalando/go-keyring"
)

// errNoSecretService は Linux で Secret Service（gnome-keyring 等）が無いときに go-keyring が返すエラーの代わり
var errNoSecretService = errors.New("The name org.freedesktop.secrets was not provided by any .service files")

// fakeKeyring は keyring の操作を差し替え、テストの終わりに戻す
func fakeKeyring(t *testing.T, get func(service, user string) (string, error), set func(service, user, password string) error) {
	t.Helper()
	origGet, origSet, origDelete := keyringGet, keyringSet, keyringDelete
	t.Cleanup(func() {
		keyringGet, keyringSet, keyringDelete = origGet, origSet, origDelete
	})
	keyringGet = get
	keyringSet = set
	keyringDelete = func(service, user string) error { return nil }
}

func unavailableGet(string, string) (string, error) { return "", errNoSecretService }
func unavailableSet(string, string, string) error   { return errNoSecretService }

func TestGetUserKeyWithoutKeyring(t *testing.T) {
	fakeKeyring(t, unavailableGet, unavailableSet)

	_, err := GetUserKey()
	if !errors.Is(err, ErrKeyringUnavailable) {
		t.Fatalf("GetUserKey() error = %v, want ErrKeyringUnavailable", err)
	}
	if !errors.Is(err, errNoSecretService) {
		t.Errorf("GetUserKey() error = %v, want the original error kept", err)
	}
}

func TestGetUserKeyNotFoundIsNotUnavailable(t *testing.T) {
	fakeKeyring(t,
		func(string, string) (string, error) { return "", keyring.ErrNotFound },
		unavailableSet)

	_, err := GetUserKey()
	if !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("GetUserKey() error = %v, want ErrNotFound", err)
	}
	if errors.Is(err, ErrKeyringUnavailable) {
		t.Errorf("a missing key must not be reported as an unavailable keyring: %v", err)
	}
}

func TestEnsureUserKeyWithoutKeyring(t *testing.T) {
	fakeKeyring(t, unavailableGet, unavailableSet)

	if err := ensureUserKey(); !errors.Is(err, ErrKeyringUnavailable) {
		t.Fatalf("ensureUserKey() error = %v, want ErrKeyringUnavailable", err)
	}
}

func TestEnsureUserKeyCreatesKey(t *testing.T) {
	stored := map[string]string{}
	fakeKeyring(t,
		func(service, user string) (string, error) {
			if v, ok := stored[service+"/"+user]; ok {
				return v, nil
			}
			return "", keyring.ErrNotFound
		},
		func(service, user, password string) error {
			stored[service+"/"+user] = password
			return nil
		})

	if err := ensureUserKey(); err != nil {
		t.Fatalf("ensureUserKey() error: %v", err)
	}
	if _, ok := stored[keyringService+"/"+keyringAccount]; !ok {
		t.Fatal("ensureUserKey() did not store a new key")
	}
	if _, err := GetUserKey(); err != nil {
		t.Errorf("GetUserKey() after ensureUserKey() error: %v", err)
	}
}

// TestPrepareUserKeyWithoutKeyring は鍵の保管場所が使えなくても起動の準備（EnsureExists）を止めないことを検証する
func TestPrepareUserKeyWithoutKeyring(t *testing.T) {
	fakeKeyring(t, unavailableGet, unavailableSet)

	if err := prepareUserKey(); err != nil {
		t.Fatalf("prepareUserKey() error = %v, want nil (startup must go on)", err)
	}
}

// TestPrepareUserKeyKeepsOtherErrors は鍵の保管場所が使えない以外の失敗は返すことを検証する
func TestPrepareUserKeyKeepsOtherErrors(t *testing.T) {
	// 鍵は無く、保存は「鍵が無い」で失敗する（保管場所が使えないのとは別の失敗）
	fakeKeyring(t,
		func(string, string) (string, error) { return "", keyring.ErrNotFound },
		func(string, string, string) error { return keyring.ErrNotFound })

	if err := prepareUserKey(); err == nil {
		t.Fatal("prepareUserKey() error = nil, want the failure returned")
	}
}
