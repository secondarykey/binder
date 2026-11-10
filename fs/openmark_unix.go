//go:build !windows

package fs

import (
	"errors"
	"os"

	"golang.org/x/sys/unix"
)

// errLocked は他のプロセス（または同じファイルの別の open）がロックを持っているときに tryLock が返す。
var errLocked = errors.New("locked by another handle")

func tryLock(f *os.File) error {
	err := unix.Flock(int(f.Fd()), unix.LOCK_EX|unix.LOCK_NB)
	if err != nil {
		if errors.Is(err, unix.EWOULDBLOCK) {
			return errLocked
		}
		return err
	}
	return nil
}

func unlock(f *os.File) error {
	return unix.Flock(int(f.Fd()), unix.LOCK_UN)
}
