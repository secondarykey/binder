package fs_test

import (
	"path/filepath"
	"testing"

	"binder/fs"
	"binder/test"
)

var testKey = []byte("0123456789abcdef0123456789abcdef") // 32-byte AES key

func TestSaveAndLoadUserInfo(t *testing.T) {
	dir := mkDir(t, filepath.Join(test.Dir, "user_info"))

	original := &fs.UserInfo{
		Name:     "Test User",
		Email:    "test@example.com",
		AuthType: fs.AuthBasic,
		Username: "user",
		Password: "pass",
	}

	if err := fs.SaveUserInfo(dir, testKey, original); err != nil {
		t.Fatalf("SaveUserInfo() error: %v", err)
	}

	loaded, err := fs.LoadUserInfo(dir, testKey)
	if err != nil {
		t.Fatalf("LoadUserInfo() error: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadUserInfo() returned nil")
	}
	if loaded.Name != original.Name {
		t.Errorf("Name: got %q, want %q", loaded.Name, original.Name)
	}
	if loaded.Email != original.Email {
		t.Errorf("Email: got %q, want %q", loaded.Email, original.Email)
	}
	if loaded.AuthType != original.AuthType {
		t.Errorf("AuthType: got %q, want %q", loaded.AuthType, original.AuthType)
	}
	if loaded.Username != original.Username {
		t.Errorf("Username: got %q, want %q", loaded.Username, original.Username)
	}
}

func TestLoadUserInfo_NotExist(t *testing.T) {
	dir := filepath.Join(test.Dir, "user_info_ne")

	info, err := fs.LoadUserInfo(dir, testKey)
	if err != nil {
		t.Fatalf("LoadUserInfo() expected nil error for missing file, got: %v", err)
	}
	if info != nil {
		t.Errorf("LoadUserInfo() expected nil for missing file, got: %+v", info)
	}
}

func TestSaveAndLoadUserData(t *testing.T) {
	f := createFileSystem(t, "user_data_fs")

	original := &fs.UserInfo{
		Name:     "FS User",
		Email:    "fs@example.com",
		AuthType: fs.AuthToken,
		Token:    "my-secret-token",
	}

	if err := f.SaveUserData(testKey, original); err != nil {
		t.Fatalf("SaveUserData() error: %v", err)
	}

	loaded, err := f.LoadUserData(testKey)
	if err != nil {
		t.Fatalf("LoadUserData() error: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadUserData() returned nil")
	}
	if loaded.Name != original.Name {
		t.Errorf("Name: got %q, want %q", loaded.Name, original.Name)
	}
	if loaded.Token != original.Token {
		t.Errorf("Token: got %q, want %q", loaded.Token, original.Token)
	}
	if loaded.AuthType != original.AuthType {
		t.Errorf("AuthType: got %q, want %q", loaded.AuthType, original.AuthType)
	}
}

func TestLoadUserData_NotExist(t *testing.T) {
	f := createFileSystem(t, "user_data_ne")

	info, err := f.LoadUserData(testKey)
	if err != nil {
		t.Fatalf("LoadUserData() expected nil error for missing file, got: %v", err)
	}
	if info != nil {
		t.Errorf("LoadUserData() expected nil for missing file, got: %+v", info)
	}
}
