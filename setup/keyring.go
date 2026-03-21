package setup

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"

	"github.com/zalando/go-keyring"
	"golang.org/x/xerrors"
)

const (
	keyringService = "com.github.binder.binder.binder"
	keyringAccount = "aes-encryption-userdata-key-v1"
)

// 存在を確認
func isExistsUserKey() bool {
	_, err := GetUserKey()
	if err != nil {
		if errors.Is(keyring.ErrNotFound, err) {
			return false
		}
		slog.Warn("ExistKey", "Error", err.Error())
	}
	return true
}

// 存在しない場合は新規生成してキーチェーンに保存する。
func GetUserKey() ([]byte, error) {

	// キーチェーンから取得を試みる
	encoded, err := keyring.Get(keyringService, keyringAccount)
	if err != nil {
		return nil, xerrors.Errorf("keyring.Get() error: %w", err)
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
