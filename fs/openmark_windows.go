//go:build windows

package fs

import (
	"errors"
	"os"

	"golang.org/x/sys/windows"
)

// errLocked は他のハンドルがロックを持っているときに tryLock が返す。
var errLocked = errors.New("locked by another handle")

// ロックする範囲。中身を読む側（ReadFile）を妨げないよう、ファイルの先頭ではなく
// 遠い位置の 1 バイトを押さえる（Windows のロックは範囲単位で、EOF より先も押さえられる）。
const lockOffsetHigh = 0x7FFFFFFF

func tryLock(f *os.File) error {
	ol := new(windows.Overlapped)
	ol.OffsetHigh = lockOffsetHigh
	err := windows.LockFileEx(windows.Handle(f.Fd()),
		windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, ol)
	if err != nil {
		if errors.Is(err, windows.ERROR_LOCK_VIOLATION) || errors.Is(err, windows.ERROR_IO_PENDING) {
			return errLocked
		}
		return err
	}
	return nil
}

func unlock(f *os.File) error {
	ol := new(windows.Overlapped)
	ol.OffsetHigh = lockOffsetHigh
	return windows.UnlockFileEx(windows.Handle(f.Fd()), 0, 1, 0, ol)
}
