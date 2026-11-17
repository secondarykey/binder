//go:build windows

package ipc

import (
	"fmt"
	"net"
	"os"
	"testing"
	"time"

	"github.com/Microsoft/go-winio"
)

func testPipeName() string {
	return fmt.Sprintf(`\\.\pipe\binder-lite-test-%d-%d`, os.Getpid(), time.Now().UnixNano())
}

// ほかの Lite がパイプを持っているあいだは待ち、持ち主が終わったら引き継ぐ。
func TestWaitListenPipeTakesOver(t *testing.T) {
	name := testPipeName()

	owner, err := winio.ListenPipe(name, nil)
	if err != nil {
		t.Fatalf("ListenPipe() error: %v", err)
	}

	type result struct {
		l   net.Listener
		err error
	}
	got := make(chan result, 1)
	go func() {
		l, err := waitListenPipe(name, 20*time.Millisecond)
		got <- result{l, err}
	}()

	// 持ち主がいるあいだは作れない（Access is denied で待ち続ける）
	select {
	case r := <-got:
		if r.l != nil {
			r.l.Close()
		}
		owner.Close()
		t.Fatalf("持ち主がいるのに戻った: err=%v", r.err)
	case <-time.After(200 * time.Millisecond):
	}

	owner.Close()

	var r result
	select {
	case r = <-got:
	case <-time.After(2 * time.Second):
		t.Fatal("持ち主が終わっても引き継がない")
	}
	if r.err != nil {
		t.Fatalf("waitListenPipe() error: %v", r.err)
	}
	defer r.l.Close()

	// 引き継いだパイプでファイルを受け取れる
	files := make(chan []string, 1)
	go func() {
		c, err := r.l.Accept()
		if err != nil {
			return
		}
		handleConn(c, func(f []string) { files <- f })
	}()

	conn, err := winio.DialPipe(name, nil)
	if err != nil {
		t.Fatalf("DialPipe() error: %v", err)
	}
	conn.Write([]byte("a.md\nb.md\n"))
	conn.Close()

	select {
	case f := <-files:
		if len(f) != 2 || f[0] != "a.md" || f[1] != "b.md" {
			t.Errorf("受け取ったファイル = %v", f)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("ファイルを受け取れない")
	}
}

// 持ち主がいなければすぐに作れる。
func TestWaitListenPipeNoOwner(t *testing.T) {
	l, err := waitListenPipe(testPipeName(), time.Hour)
	if err != nil {
		t.Fatalf("waitListenPipe() error: %v", err)
	}
	l.Close()
}
