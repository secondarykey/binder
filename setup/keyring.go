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

// ErrKeyringUnavailable は OS の鍵の保管場所（Windows の資格情報マネージャー・macOS のキーチェーン・
// Linux の Secret Service）が使えないことを表す。
//
// Linux では gnome-keyring などが Secret Service（org.freedesktop.secrets）を提供していないと使えない
// （WSL・デスクトップ環境の無い Linux・keyring を動かしていない軽いデスクトップ）。
// 鍵が無いと認証情報（user_data.enc）を暗号化して保存・読み込みできないが、アプリの起動は止めない。
// 鍵が要る操作（個人情報設定・認証情報を保存しての送信）だけが、このエラーを返す。
var ErrKeyringUnavailable = errors.New("keyring unavailable")

// keyring の操作。テストで差し替えられるように変数にしている
// （go-keyring の MockInit はプロセス全体を差し替えて元に戻せないため）。
var (
	keyringGet    = keyring.Get
	keyringSet    = keyring.Set
	keyringDelete = keyring.Delete
)

// keyringErr は keyring の操作のエラーを、鍵が無い（ErrNotFound）以外は ErrKeyringUnavailable として包む。
func keyringErr(op string, err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, keyring.ErrNotFound) {
		return xerrors.Errorf("%s error: %w", op, err)
	}
	return xerrors.Errorf("%s error: %w", op, fmt.Errorf("%w: %w", ErrKeyringUnavailable, err))
}

// 存在を確認
func isExistsUserKey() bool {
	_, err := GetUserKey()
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return false
		}
		log.PrintStackTrace(err)
		return true
	}
	return true
}

// GetUserKey は認証情報の暗号化に使う鍵を OS の鍵の保管場所から取り出す。
// 保管場所が使えなければ ErrKeyringUnavailable を包んだエラーを返す。
func GetUserKey() ([]byte, error) {

	// 新サービス名でキーチェーンから取得を試みる
	encoded, err := keyringGet(keyringService, keyringAccount)
	if err != nil {
		if !errors.Is(err, keyring.ErrNotFound) {
			return nil, keyringErr("keyring.Get()", err)
		}
		// 旧サービス名でフォールバック
		encoded, err = keyringGet(keyringServiceLegacy, keyringAccount)
		if err != nil {
			return nil, keyringErr("keyring.Get(legacy)", err)
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
	if err := keyringSet(keyringService, keyringAccount, encoded); err != nil {
		return keyringErr("keyring.Set()", err)
	}
	return nil
}

// prepareUserKey は起動時に鍵を用意する。
// OS の鍵の保管場所が使えない（Linux で Secret Service が無い等）ときは警告を残して nil を返し、起動を止めない。
// 鍵が要る操作（個人情報設定・認証情報を保存しての送信）だけが ErrKeyringUnavailable を返す。
func prepareUserKey() error {
	err := ensureUserKey()
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrKeyringUnavailable) {
		log.Warnf("鍵の保管場所が使えないため、認証情報は保存できません:\n%+v", err)
		return nil
	}
	return err
}

// ensureUserKey は鍵を用意する（旧サービス名からの移行と、無ければ新規作成）。
func ensureUserKey() error {
	// 旧サービス名のキーを新サービス名に移行
	if err := migrateUserKeyService(); err != nil {
		return xerrors.Errorf("migrateUserKeyService() error: %w", err)
	}

	//暗号化キーが存在しない場合
	if !isExistsUserKey() {
		if err := setUserKey(); err != nil {
			return xerrors.Errorf("setUserKey() error: %w", err)
		}
	}
	return nil
}

// migrateUserKeyService は旧サービス名のキーを新サービス名に移行する。
// 新サービス名にすでにキーがある場合は何もしない。
// 移行完了後、旧サービス名のキーを削除する。
func migrateUserKeyService() error {

	// 新サービス名に既にキーがあれば移行不要
	_, err := keyringGet(keyringService, keyringAccount)
	if err == nil {
		return nil
	}
	if !errors.Is(err, keyring.ErrNotFound) {
		return keyringErr("keyring.Get(new)", err)
	}

	// 旧サービス名のキーを取得
	encoded, err := keyringGet(keyringServiceLegacy, keyringAccount)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil // 旧キーもない → 移行不要（新規生成へ）
		}
		return keyringErr("keyring.Get(legacy)", err)
	}

	// 新サービス名で保存
	if err := keyringSet(keyringService, keyringAccount, encoded); err != nil {
		return keyringErr("keyring.Set(new)", err)
	}

	// 旧サービス名のキーを削除（移行完了後）
	if err := keyringDelete(keyringServiceLegacy, keyringAccount); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		log.Warnf("migrateUserKeyService: Delete legacy key:\n%+v", err)
		// 削除失敗はエラーとせず警告のみ（新サービス名への移行は完了しているため）
	}
	return nil
}
