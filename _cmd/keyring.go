package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/zalando/go-keyring"
)

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

const (
	keyringService = "com.github.binder.binder.userdata"
	keyringAccount = "aes-encryption-key-v1"
	dataFile       = "user_data.enc"
)

// -------------------------------------------------------
// User 構造体
// -------------------------------------------------------

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Age   int    `json:"age"`
}

// -------------------------------------------------------
// キー管理
// -------------------------------------------------------

// getOrCreateKey はキーチェーンから暗号化キーを取得する。
// 存在しない場合は新規生成してキーチェーンに保存する。
func getOrCreateKey() ([]byte, error) {
	// キーチェーンから取得を試みる
	encoded, err := keyring.Get(keyringService, keyringAccount)
	if err == nil {
		// 16進数文字列 → []byte に変換
		key := make([]byte, 32)
		_, err = fmt.Sscanf(encoded, "%x", &key)
		if err != nil {
			return nil, fmt.Errorf("キーのデコードに失敗: %w", err)
		}
		fmt.Println("キーチェーンから暗号化キーを取得しました")
		return key, nil
	}

	// キーが存在しない → 新規生成
	fmt.Println("暗号化キーが見つかりません。新規生成します...")
	key := make([]byte, 32) // AES-256
	if _, err = io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("キーの生成に失敗: %w", err)
	}

	// キーチェーンへ保存（16進数文字列として格納）
	encoded = fmt.Sprintf("%x", key)
	if err = keyring.Set(keyringService, keyringAccount, encoded); err != nil {
		return nil, fmt.Errorf("キーチェーンへの保存に失敗: %w", err)
	}
	fmt.Println("新しい暗号化キーをキーチェーンに保存しました")
	return key, nil
}

// -------------------------------------------------------
// 暗号化
// -------------------------------------------------------

// SaveUser は User を JSON シリアライズ → AES-GCM 暗号化 → ファイル保存する。
func SaveUser(user User) error {
	// 1. キー取得
	key, err := getOrCreateKey()
	if err != nil {
		return err
	}

	// 2. JSON シリアライズ
	plaintext, err := json.Marshal(user)
	if err != nil {
		return fmt.Errorf("JSON変換に失敗: %w", err)
	}

	// 3. AES-GCM 暗号化
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("AES初期化に失敗: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("GCM初期化に失敗: %w", err)
	}

	// Nonce（初期化ベクトル）をランダム生成
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("nonce生成に失敗: %w", err)
	}

	// [nonce | 暗号文+認証タグ] の形式で結合
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	// 4. ファイルへ書き込み
	if err = os.WriteFile(dataFile, ciphertext, 0600); err != nil {
		return fmt.Errorf("ファイル書き込みに失敗: %w", err)
	}

	fmt.Printf("User を暗号化して %s に保存しました\n", dataFile)
	return nil
}

// -------------------------------------------------------
// 復号
// -------------------------------------------------------

// LoadUser は暗号化ファイルを読み込み → AES-GCM 復号 → User に変換する。
func LoadUser() (User, error) {
	var user User

	// 1. キー取得
	key, err := getOrCreateKey()
	if err != nil {
		return user, err
	}

	// 2. ファイル読み込み
	data, err := os.ReadFile(dataFile)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return user, fmt.Errorf("暗号化ファイルが見つかりません: %s", dataFile)
		}
		return user, fmt.Errorf("ファイル読み込みに失敗: %w", err)
	}

	// 3. AES-GCM 復号
	block, err := aes.NewCipher(key)
	if err != nil {
		return user, fmt.Errorf("AES初期化に失敗: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return user, fmt.Errorf("GCM初期化に失敗: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return user, errors.New("データが短すぎます（ファイルが破損している可能性があります）")
	}

	// Nonce と暗号文を分離
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		// 認証失敗 = キーが違う or ファイルが改ざんされている
		return user, errors.New("復号に失敗しました（キーが違うか、ファイルが改ざんされています）")
	}

	// 4. JSON デシリアライズ
	if err = json.Unmarshal(plaintext, &user); err != nil {
		return user, fmt.Errorf("JSON解析に失敗: %w", err)
	}

	fmt.Printf("%s を復号して User に変換しました\n", dataFile)
	return user, nil
}

// -------------------------------------------------------
// main（動作確認）
// -------------------------------------------------------

func main() {
	// --- 保存 ---
	original := User{
		ID:    1,
		Name:  "山田 太郎",
		Email: "taro@example.com",
		Age:   30,
	}
	fmt.Printf("\n[保存] %+v\n", original)

	if err := SaveUser(original); err != nil {
		fmt.Println("保存エラー:", err)
		return
	}

	// --- 読み込み ---
	fmt.Println("\n[読み込み]")
	loaded, err := LoadUser()
	if err != nil {
		fmt.Println("読み込みエラー:", err)
		return
	}

	fmt.Printf("復元された User: %+v\n", loaded)

	// --- 一致確認 ---
	orig, _ := json.Marshal(original)
	load, _ := json.Marshal(loaded)
	if string(orig) == string(load) {
		fmt.Println("\n✓ 元データと復元データが一致しました")
	} else {
		fmt.Println("\n✗ データが一致しません")
	}
}
