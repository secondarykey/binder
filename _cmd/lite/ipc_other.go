//go:build !windows

package main

func trySendToExisting(files []string) bool {
	return false
}

func listenForFiles(onFilesReceived func([]string)) {}
