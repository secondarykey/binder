package setup

import (
	"binder/log"

	"crypto/rand"
	"errors"
	"fmt"
	"io"

	"github.com/zalando/go-keyring"
	"golang.org/x/xerrors"
)

const (
	keyringService       = "com.github.binder.client"
	keyringServiceLegacy = "com.github.binder.binder.binder"
	keyringAccount       = "aes-encryption-userdata-key-v1"
)

// 存在を確認
func isExistsUserKey() bool {
	_, err := GetUserKey()
	if err != nil {
		if errors.Is(keyring.ErrNotFound, err) {
			return false
		}
		log.PrintStackTrace(err)
		return true
	}
	return true
}

// 存在しない場合は新規生成してキーチェーンに保存する。
func GetUserKey() ([]byte, error) {

	// 新サービス名でキーチェーンから取得を試みる
	encoded, err := keyring.Get(keyringService, keyringAccount)
	if err != nil {
		if !errors.Is(err, keyring.ErrNotFound) {
			return nil, xerrors.Errorf("keyring.Get() error: %w", err)
		}
		// 旧サービス名でフォールバック
		encoded, err = keyring.Get(keyringServiceLegacy, keyringAccount)
		if err != nil {
			return nil, xerrors.Errorf("keyring.Get() error: %w", err)
		}
	}

	// 16進数文字列 → []byte に変換
	key := make([]byte, 32)
	_, err = fmt.Sscanf(encoded, "%x", &key)
	if err != nil {
		return nil, xerrors.Errorf("fmt.Scanf(%x) error: %w", err)
	}
	return key, nil
}

func setUserKey() error {

	// キーが存在しない → 新規生成
	key := make([]byte, 32) // AES-256
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return fmt.Errorf("キーの生成に失敗: %w", err)
	}

	// キーチェーンへ保存（16進数文字列として格納）
	encoded := fmt.Sprintf("%x", key)
	if err := keyring.Set(keyringService, keyringAccount, encoded); err != nil {
		return fmt.Errorf("キーチェーンへの保存に失敗: %w", err)
	}
	return nil
}

// migrateUserKeyService は旧サービス名のキーを新サービス名に移行する。
// 新サービス名にすでにキーがある場合は何もしない。
// 移行完了後、旧サービス名のキーを削除する。
func migrateUserKeyService() error {

	// 新サービス名に既にキーがあれば移行不要
	_, err := keyring.Get(keyringService, keyringAccount)
	if err == nil {
		return nil
	}
	if !errors.Is(err, keyring.ErrNotFound) {
		return xerrors.Errorf("keyring.Get(new) error: %w", err)
	}

	// 旧サービス名のキーを取得
	encoded, err := keyring.Get(keyringServiceLegacy, keyringAccount)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil // 旧キーもない → 移行不要（新規生成へ）
		}
		return xerrors.Errorf("keyring.Get(legacy) error: %w", err)
	}

	// 新サービス名で保存
	if err := keyring.Set(keyringService, keyringAccount, encoded); err != nil {
		return xerrors.Errorf("keyring.Set(new) error: %w", err)
	}

	// 旧サービス名のキーを削除（移行完了後）
	if err := keyring.Delete(keyringServiceLegacy, keyringAccount); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		log.WarnE("migrateUserKeyService: Delete legacy key", err)
		// 削除失敗はエラーとせず警告のみ（新サービス名への移行は完了しているため）
	}
	return nil
}
