//go:build !windows

package ipc

// SendToExisting は Windows 以外では何もしない（既存インスタンスへの受け渡しは無い）。
func SendToExisting(files []string) bool {
	return false
}

// ListenForFiles は Windows 以外では何もしない。
func ListenForFiles(onFilesReceived func([]string)) {}
