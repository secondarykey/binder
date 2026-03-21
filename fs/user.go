package fs

import (
	"os"
	"path/filepath"

	"golang.org/x/xerrors"
)

const (
	UserFileName  = "user_data.enc"
	GitIgnoreFile = ".gitignore"
)

// AuthType は認証方式の種別
type AuthType string

const (
	AuthNone     AuthType = ""
	AuthBasic    AuthType = "basic"     // HTTP Basic (Username + Password)
	AuthToken    AuthType = "token"     // HTTP Token
	AuthSSHFile  AuthType = "ssh_file"  // SSH鍵ファイル (Filename + Passphrase)
	AuthSSHAgent AuthType = "ssh_agent" // SSHエージェント
	AuthSSHBytes AuthType = "ssh_bytes" // SSH鍵バイト列 (Bytes + Passphrase)
)

type UserInfo struct {
	Name       string   `json:"name"`
	Email      string   `json:"email"`
	AuthType   AuthType `json:"auth_type"`
	Username   string   `json:"username"`
	Password   string   `json:"password"`
	Token      string   `json:"token"`
	Passphrase string   `json:"passphrase"`
	Filename   string   `json:"filename"`
	Bytes      []byte   `json:"bytes"`
}

// SaveUserInfo はUserInfoを暗号化してバインダー直下に保存する。
func SaveUserInfo(dir string, key []byte, info *UserInfo) error {
	data, err := encrypt(key, info)
	if err != nil {
		return xerrors.Errorf("encrypt() error: %w", err)
	}

	p := filepath.Join(dir, UserFileName)
	if err = os.WriteFile(p, data, 0600); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", UserFileName, err)
	}
	return nil
}

// LoadUserInfo はバインダー直下の暗号化ファイルを読み込みUserInfoに復号する。
// ファイルが存在しない場合は nil, nil を返す。
func LoadUserInfo(dir string, key []byte) (*UserInfo, error) {
	p := filepath.Join(dir, UserFileName)
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, xerrors.Errorf("os.ReadFile(%s) error: %w", UserFileName, err)
	}

	var info UserInfo
	if err = decrypt(key, data, &info); err != nil {
		return nil, xerrors.Errorf("decrypt() error: %w", err)
	}
	return &info, nil
}
