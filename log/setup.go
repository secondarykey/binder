package log

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	wlog "github.com/wenteasy/log"
	"golang.org/x/xerrors"
)

// Options は Init で組む出口。
type Options struct {
	Dir     string // ログファイルのフォルダ。空ならファイルに書かない（無ければ作る）
	Console bool   // 標準エラー出力にも出す（開発中だけ立てる。GUI の exe では見えない）
}

// FilePrefix はログファイルの名前の頭（binder_20261015.log）。
const FilePrefix = "binder"

// DirEnv はログのフォルダを変える環境変数。試しに起動するとき（テストやエージェントの確認）に、普段のログと混ぜないために使う。
const DirEnv = "BINDER_LOG_DIR"

// writer は今のログファイル。Path で読む場所（ログビューア）を返すために持つ。
var writer *wlog.RollingFileWriter

// DefaultDir はログのフォルダ。DirEnv があればそこ、無ければ一時フォルダの binder/。
// 一時フォルダは OS の掃除で消えることがあるが、Binder はアプリ内のログビューアで見るので、何日も前の記録は残さなくてよい。
func DefaultDir() string {
	if dir := os.Getenv(DirEnv); dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), "binder")
}

// Init は出口を組み、slog.Default() をそこへ向ける。アプリの main の最初に 1 回だけ呼ぶ。
// ファイルは Dir に日ごと（binder_20060102.log）に作る。最初に書いたときに開き、日付が変わると次のファイルへ切り替わる。
// ファイルを作れなくても止めない（出せる出口で組み、理由を返す）。返す io.Closer は nil にしない。
func Init(opts Options) (io.Closer, error) {
	var sinks []slog.Handler
	var closer io.Closer = nopCloser{}
	var err error
	if opts.Dir != "" {
		w, werr := wlog.NewRollingFileWriter(opts.Dir, wlog.Day)
		if werr == nil {
			w.SetPrefix(FilePrefix)
			writer = w
			sinks = append(sinks, wlog.NewSimpleHandler(w, &logLevel))
			closer = fileCloser{}
		} else {
			err = xerrors.Errorf("ログのフォルダ %s を作れないので、ログはファイルに残りません: %w", opts.Dir, werr)
		}
	}
	if opts.Console || len(sinks) == 0 {
		sinks = append(sinks, wlog.NewSimpleHandler(os.Stderr, &logLevel))
	}

	var h slog.Handler = multiHandler(sinks)
	if len(sinks) == 1 {
		h = sinks[0]
	}
	slog.SetDefault(slog.New(h))
	return closer, err
}

// Path は現在のログファイルのパスを返す。
// ファイルに書いていない、またはまだ 1 件も書いていない場合は空文字を返す。
func Path() string {
	if writer == nil {
		return ""
	}
	return writer.Path()
}

// fileCloser はログファイルを閉じる。
type fileCloser struct{}

func (fileCloser) Close() error {
	if writer == nil {
		return nil
	}
	err := writer.Close()
	writer = nil
	return err
}

type nopCloser struct{}

func (nopCloser) Close() error { return nil }

// multiHandler は同じ Record を複数の出口へ渡す。
// go.mod が Go 1.26 以上になったら slog.NewMultiHandler に置き換える。
type multiHandler []slog.Handler

func (m multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m multiHandler) Handle(ctx context.Context, r slog.Record) error {
	var errs []error
	for _, h := range m {
		if h.Enabled(ctx, r.Level) {
			errs = append(errs, h.Handle(ctx, r.Clone()))
		}
	}
	return errors.Join(errs...)
}

func (m multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	hs := make(multiHandler, len(m))
	for i, h := range m {
		hs[i] = h.WithAttrs(attrs)
	}
	return hs
}

func (m multiHandler) WithGroup(name string) slog.Handler {
	hs := make(multiHandler, len(m))
	for i, h := range m {
		hs[i] = h.WithGroup(name)
	}
	return hs
}
