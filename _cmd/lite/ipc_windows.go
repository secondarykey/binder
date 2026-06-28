//go:build windows

package main

import (
	"bufio"
	"net"
	"strings"

	"binder/log"

	"github.com/Microsoft/go-winio"
)

const pipeName = `\\.\pipe\binder-lite`

// trySendToExisting は既存インスタンスにファイルパスを送信する。
// 既存インスタンスが見つかればファイルを送って true を返す。
// 見つからなければ false を返す。
func trySendToExisting(files []string) bool {
	conn, err := winio.DialPipe(pipeName, nil)
	if err != nil {
		return false
	}
	defer conn.Close()
	for _, f := range files {
		conn.Write([]byte(f + "\n"))
	}
	return true
}

// listenForFiles は名前付きパイプサーバーを起動し、他プロセスからのファイル受信を待機する。
func listenForFiles(onFilesReceived func([]string)) {
	go func() {
		l, err := winio.ListenPipe(pipeName, nil)
		if err != nil {
			log.Warn("ListenPipe() error: %v", err)
			return
		}
		defer l.Close()

		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			go handleConn(c, onFilesReceived)
		}
	}()
}

func handleConn(c net.Conn, onFilesReceived func([]string)) {
	defer c.Close()
	var files []string
	scanner := bufio.NewScanner(c)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			files = append(files, line)
		}
	}
	if len(files) > 0 {
		onFilesReceived(files)
	}
}
