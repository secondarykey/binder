//go:build !windows

package main

func tryAcquireSingleInstance(files []string, onFilesReceived func([]string)) bool {
	return true
}
