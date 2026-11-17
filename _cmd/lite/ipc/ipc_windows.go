//go:build windows

// Package ipc は、起動した Lite から動いている Lite へ開くファイルを渡す（Windows の名前付きパイプ）。
// 最初の Lite がパイプを持ち、あとから起動した Lite はファイルを送って終わる。
package ipc

import (
	"bufio"
	"errors"
	"net"
	"strings"
	"syscall"
	"time"

	"binder/log"

	"github.com/Microsoft/go-winio"
)

const pipeName = `\\.\pipe\binder-lite`

// listenRetryInterval は、ほかの Lite がパイプを持っているあいだ、作り直しを試す間隔。
const listenRetryInterval = 2 * time.Second

// SendToExisting は既存インスタンスにファイルパスを送信する。
// 既存インスタンスが見つかればファイルを送って true を返す。
// 見つからなければ false を返す。
func SendToExisting(files []string) bool {
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

// ListenForFiles は名前付きパイプサーバーを起動し、他プロセスからのファイル受信を待機する。
// ほかの Lite が先にパイプを持っていれば、その Lite が終わるのを待って引き継ぐ。
func ListenForFiles(onFilesReceived func([]string)) {
	go func() {
		l, err := waitListenPipe(pipeName, listenRetryInterval)
		if err != nil {
			log.Warnf("ListenPipe() error: %v", err)
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

// waitListenPipe は name のパイプを作り、作れるまで待つ。
//
// go-winio はパイプを「新しく作る」指定（FILE_CREATE）で作るため、
// ほかの Lite が同じ名前のパイプを持っていると Access is denied で失敗する。
// これは 2 つ目以降の Lite では毎回起きることなので、interval ごとに作り直しを試し、
// 持ち主の Lite が終わったら引き継ぐ。ほかのエラーはそのまま返す。
func waitListenPipe(name string, interval time.Duration) (net.Listener, error) {
	waiting := false
	for {
		l, err := winio.ListenPipe(name, nil)
		if err == nil {
			if waiting {
				log.Info("ほかの Lite が終わったので、ファイルの受け取りを引き継ぎました", "pipe", name)
			}
			return l, nil
		}
		if !errors.Is(err, syscall.ERROR_ACCESS_DENIED) {
			return nil, err
		}
		if !waiting {
			log.Info("ほかの Lite がファイルを受け取っているので、終わるまで待ちます", "pipe", name)
			waiting = true
		}
		time.Sleep(interval)
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
