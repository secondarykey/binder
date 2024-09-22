package fs

import (
	"fmt"
)

func (b *FileSystem) PrintStatus() {

	w, err := b.repo.Worktree()
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
