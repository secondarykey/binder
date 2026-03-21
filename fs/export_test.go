package fs

import (
	"fmt"
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
