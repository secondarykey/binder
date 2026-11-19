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

	"golang.org/x/xerrors"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
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
	allowForeground(conn)
	for _, f := range files {
		conn.Write([]byte(f + "\n"))
	}
	return true
}

var procAllowSetForegroundWindow = windows.NewLazySystemDLL("user32.dll").NewProc("AllowSetForegroundWindow")

// allowForeground は、パイプの持ち主の Lite がウィンドウを前面に出せるようにする。
//
// Windows は、裏で動いているプロセスが自分で SetForegroundWindow しても前面に出さない
// （タスクバーが点滅するだけ）。エクスプローラーから起動されたこちらのプロセスは前面に出る権利を
// 持っているので、送る前に持ち主へ AllowSetForegroundWindow で譲る。
// 譲れなくてもファイルは開けるので、失敗はログに残すだけにする。
func allowForeground(conn net.Conn) {
	pid, err := pipeServerPID(conn)
	if err != nil {
		log.Info("パイプの持ち主の Lite が分からないので、前面に出す許可を渡しません", "err", err)
		return
	}
	if r, _, err := procAllowSetForegroundWindow.Call(uintptr(pid)); r == 0 {
		log.Info("前面に出す許可を渡せませんでした", "pid", pid, "err", err)
	}
}

// pipeServerPID は、conn の向こうでパイプを持っているプロセスの ID を返す。
func pipeServerPID(conn net.Conn) (uint32, error) {
	fd, ok := conn.(interface{ Fd() uintptr })
	if !ok {
		return 0, xerrors.Errorf("パイプのハンドルを取れません: %T", conn)
	}
	var pid uint32
	if err := windows.GetNamedPipeServerProcessId(windows.Handle(fd.Fd()), &pid); err != nil {
		return 0, xerrors.Errorf("GetNamedPipeServerProcessId() error: %w", err)
	}
	return pid, nil
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
