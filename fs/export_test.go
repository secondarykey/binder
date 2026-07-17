package fs

import (
	"fmt"

	"github.com/go-git/go-git/v5"
)

func (f *FileSystem) PrintDebugStatus() {

	w, err := f.repo.Worktree()
	status, err := w.Status()
	if err != nil {
		return
	}

	// Statusがある場合pushできない
	fmt.Printf("%-60s| %-10s | %-10s | %s\n", "FileName", "Staging", "Worktree", "Extra")
	for key, s := range status {
		fmt.Printf("%-60s| %10c | %10c | %s\n", key, s.Staging, s.Worktree, s.Extra)
	}
}

func (f *FileSystem) IsExist(fn string) bool {
	return f.isExist(fn)
}

func Encrypt(key []byte, v any) ([]byte, error) {
	return encrypt(key, v)
}
func Decrypt(key []byte, data []byte, v any) error {
	return decrypt(key, data, v)
}

// CorruptIndexForTest は .git/index を任意のバイト列で上書きする（破損再現用）。
func (f *FileSystem) CorruptIndexForTest(data []byte) error {
	dot, err := f.fs.Chroot(git.GitDirName)
	if err != nil {
		return err
	}
	fp, err := dot.Create("index")
	if err != nil {
		return err
	}
	defer fp.Close()
	_, err = fp.Write(data)
	return err
}

// RepairIndexForTest は Load() 相当のインデックス破損チェック・自動復旧を実行する。
func (f *FileSystem) RepairIndexForTest() {
	f.repairIndexIfCorrupt()
}

// BrokenIndexBackupExistsForTest は破損時の退避ファイル（index.broken）の存在を返す。
func (f *FileSystem) BrokenIndexBackupExistsForTest() bool {
	dot, err := f.fs.Chroot(git.GitDirName)
	if err != nil {
		return false
	}
	_, err = dot.Stat(brokenIndexFile)
	return err == nil
}
