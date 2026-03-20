package setup

import (
	"crypto/rand"
	"fmt"
	"io"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "com.github.binder.binder.binder"
	keyringAccount = "aes-encryption-userdata-key-v1"
)

// 存在しない場合は新規生成してキーチェーンに保存する。
func GetOrCreateKey() ([]byte, error) {

	// キーチェーンから取得を試みる
	encoded, err := keyring.Get(keyringService, keyringAccount)
	if err == nil {
		// 16進数文字列 → []byte に変換
		key := make([]byte, 32)
		_, err = fmt.Sscanf(encoded, "%x", &key)
		if err != nil {
			return nil, fmt.Errorf("キーのデコードに失敗: %w", err)
		}
		return key, nil
	}

	// キーが存在しない → 新規生成
	key := make([]byte, 32) // AES-256
	if _, err = io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("キーの生成に失敗: %w", err)
	}

	// キーチェーンへ保存（16進数文字列として格納）
	encoded = fmt.Sprintf("%x", key)
	if err = keyring.Set(keyringService, keyringAccount, encoded); err != nil {
		return nil, fmt.Errorf("キーチェーンへの保存に失敗: %w", err)
	}

	return key, nil
}
