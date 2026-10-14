package log

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	wlog "github.com/wenteasy/log"
	"golang.org/x/xerrors"
)

// Options は Init で組む出口。
type Options struct {
	Dir     string // ログファイルのフォルダ。空ならファイルに書かない（無ければ作る）
	Console bool   // 標準エラー出力にも出す（開発中だけ立てる。GUI の exe では見えない）
	// KeepDays は Dir に残す日数（今日を含む）。Init のときに、それより古いログファイルを消す。0 なら消さない
	KeepDays int
}

// FilePrefix はログファイルの名前の頭（binder_20261015.log）。
const FilePrefix = "binder"

// DirEnv はログのフォルダを変える環境変数。試しに起動するとき（テストやエージェントの確認）に、普段のログと混ぜないために使う。
const DirEnv = "BINDER_LOG_DIR"

// DefaultKeepDays はログを残す日数（今日を含む）。Binder と Lite は同じフォルダに書くので、日数もここで 1 つに決める。
const DefaultKeepDays = 10

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
			if opts.KeepDays > 0 {
				legacy := filepath.Clean(opts.Dir) == filepath.Join(os.TempDir(), "binder")
				removeOld(opts.Dir, opts.KeepDays, legacy, time.Now())
			}
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

// removeOld は dir の古いログファイルを消し、今日を含めて keepDays 日分を残す。
//   - binder_<日付>.log
//   - <日付>.log（ファイル名に頭の文字が無かったころのもの。legacy のとき＝一時フォルダの binder/ だけ。
//     BINDER_LOG_DIR で指したフォルダには Binder のものではないファイルがあり得るので触らない）
//   - 中身の無い binder_crash_pid<ID>.log（強制終了で消せなかったもの。書き出し先は書き換わらないので、作った日で見る）。
//     動いているプロセスのものは、Windows では開いているので消せない。ほかの OS で keepDays を超えて動き続けているプロセスのものは
//     消えてしまい、そのプロセスの異常終了は残らない（まれなので許す）
//
// 改名した異常終了の記録（binder_crash_<日時>.log）は消さない。消せないファイル（ほかのプロセスが開いている）は飛ばす。
func removeOld(dir string, keepDays int, legacy bool, now time.Time) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	y, m, d := now.Date()
	oldest := time.Date(y, m, d-(keepDays-1), 0, 0, 0, 0, now.Location()) // 残す一番古い日
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".log") {
			continue
		}
		path := filepath.Join(dir, name)

		if strings.HasPrefix(name, crashPrefix+crashPIDMark) {
			info, err := e.Info()
			if err == nil && info.Size() == 0 && info.ModTime().Before(oldest) {
				os.Remove(path)
			}
			continue
		}

		date := strings.TrimSuffix(name, ".log")
		if strings.HasPrefix(date, FilePrefix+"_") {
			date = strings.TrimPrefix(date, FilePrefix+"_")
		} else if !legacy {
			continue
		}
		t, err := time.ParseInLocation("20060102", date, now.Location())
		if err != nil || !t.Before(oldest) {
			continue
		}
		os.Remove(path)
	}
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
