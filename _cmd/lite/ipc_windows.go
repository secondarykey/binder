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

// tryAcquireSingleInstance は名前付きパイプでシングルインスタンス制御を行う。
// 既にインスタンスが存在すればファイルパスを送信して false を返す。
// 最初のインスタンスならパイプサーバーを起動して true を返す。
func tryAcquireSingleInstance(files []string, onFilesReceived func([]string)) bool {
	conn, err := winio.DialPipe(pipeName, nil)
	if err == nil {
		defer conn.Close()
		for _, f := range files {
			conn.Write([]byte(f + "\n"))
		}
		return false
	}

	go listenPipe(onFilesReceived)
	return true
}

func listenPipe(onFilesReceived func([]string)) {
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
