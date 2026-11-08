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
	// KeepDays は Dir に残す日数（今日を含む）。それより古いログファイルを消す。0 なら消さない
	KeepDays int
	// CompressDays はそのまま読める形で残す日数（今日を含む）。それより古いログファイルを gzip（binder_<日付>.log.gz）にする。0 なら圧縮しない
	CompressDays int
}

// FilePrefix はログファイルの名前の頭（binder_20261015.log）。
const FilePrefix = "binder"

// DirEnv はログのフォルダを変える環境変数。試しに起動するとき（テストやエージェントの確認）に、普段のログと混ぜないために使う。
const DirEnv = "BINDER_LOG_DIR"

// DefaultKeepDays はログを残す日数（今日を含む）。Binder と Lite は同じフォルダに書くので、日数もここで 1 つに決める。
// 古いものは圧縮する（実際のログでおよそ 1/7）ので、圧縮しなかったころの 10 日分の 1.5 倍ほどの大きさで 3 か月分が残る。
const DefaultKeepDays = 90

// DefaultCompressDays はそのまま読める形で残す日数（今日を含む）。
// 1 だと、何も書かずに日をまたいで開いたままのプロセス（閉じるときに前の日のファイルへ 1 行書く）のファイルを、
// ほかのプロセスが先に圧縮してしまう。数日あれば、そうなることはまず無い。
const DefaultCompressDays = 3

// writer は今のログファイル。Path で読む場所（ログビューア）を返すために持つ。
var writer *wlog.RollingFileWriter

// DefaultDir はログのフォルダ。DirEnv があればそこ、無ければ一時フォルダの binder/。
// 一時フォルダは OS の掃除で消えることがあるので、DefaultKeepDays の日数が残るとは限らない（log/TODO.md）。
func DefaultDir() string {
	if dir := os.Getenv(DirEnv); dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), "binder")
}

// Init は出口を組み、slog.Default() をそこへ向ける。アプリの main の最初に 1 回だけ呼ぶ。
// ファイルは Dir に日ごと（binder_20060102.log）に作る。最初に書いたときに開き、日付が変わると次のファイルへ切り替わる。
// 古いファイルの片付け（KeepDays・CompressDays）は wenteasy/log の RollingFileWriter に任せる。最初に書いたときと日付が変わったときに、
// 別の goroutine で動く（書くのは待たない）。片付けのエラーはこのログに Warn で書く。
// RollingFileWriter が扱わない名前のファイル（removeLeftovers）だけは、ここで書き始める前に消す。
// ファイルを作れなくても止めない（出せる出口で組み、理由を返す）。返す io.Closer は nil にしない。
func Init(opts Options) (io.Closer, error) {
	var sinks []slog.Handler
	var closer io.Closer = nopCloser{}
	var err error
	if opts.Dir != "" {
		w, werr := wlog.NewRollingFileWriter(opts.Dir, wlog.Day)
		if werr == nil {
			w.SetPrefix(FilePrefix)
			w.SetKeep(opts.KeepDays)
			w.SetCompressAfter(opts.CompressDays)
			w.SetErrorHandler(func(err error) {
				Warn("古いログファイルを片付けられませんでした", "err", err)
			})
			writer = w
			if opts.KeepDays > 0 {
				legacy := filepath.Clean(opts.Dir) == filepath.Join(os.TempDir(), "binder")
				removeLeftovers(opts.Dir, opts.KeepDays, legacy, time.Now())
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

// removeLeftovers は、RollingFileWriter の片付け（binder_<日付>.log / .log.gz）にかからない古いファイルを消す。
// keepDays は Options.KeepDays と同じ数え方（今日を含めて keepDays 日分を残す）。
//   - <日付>.log（ファイル名に頭の文字が無かったころ＝v0.17.2 までのもの。legacy のとき＝一時フォルダの binder/ だけ。
//     BINDER_LOG_DIR で指したフォルダには Binder のものではないファイルがあり得るので触らない）
//   - 中身の無い binder_crash_pid<ID>.log（強制終了で消せなかったもの。書き出し先は書き換わらないので、作った日で見る）。
//     動いているプロセスのものは、Windows では開いているので消せない。ほかの OS で keepDays を超えて動き続けているプロセスのものは
//     消えてしまい、そのプロセスの異常終了は残らない（まれなので許す）
//
// 改名した異常終了の記録（binder_crash_<日時>.log）は消さない。消せないファイル（ほかのプロセスが開いている）は飛ばす。
func removeLeftovers(dir string, keepDays int, legacy bool, now time.Time) {
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

		if !legacy {
			continue
		}
		t, err := time.ParseInLocation("20060102", strings.TrimSuffix(name, ".log"), now.Location())
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
