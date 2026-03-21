package fs

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

func encrypt(key []byte, v any) ([]byte, error) {

	gcm, err := createGCM(key)
	if err != nil {
		return nil, xerrors.Errorf("createGCM() error: %w", err)
	}

	// Nonce（初期化ベクトル）をランダム生成
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, xerrors.Errorf("io.ReadFull() error: %w", err)
	}

	// Json化
	plain, err := json.Marshal(v)
	if err != nil {
		return nil, xerrors.Errorf("json.Marshal() error: %w", err)
	}

	// [nonce | 暗号文+認証タグ] の形式で結合
	cipher := gcm.Seal(nonce, nonce, plain, nil)

	return cipher, nil
}

func createGCM(key []byte) (cipher.AEAD, error) {

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes.NewCipher() error: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("cipher.NewGCM() error: %w", err)
	}
	return gcm, nil
}

func decrypt(key []byte, data []byte, v any) error {

	gcm, err := createGCM(key)
	if err != nil {
		return xerrors.Errorf("createGCM() error: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return fmt.Errorf("NonceSize error: %d < %d", len(data), nonceSize)
	}

	// Nonce
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return xerrors.Errorf("gcm.Open() error: %w", err)
	}

	// json
	if err = json.Unmarshal(plain, v); err != nil {
		return xerrors.Errorf("json.Unmarshal() error: %w", err)
	}
	return nil
}
