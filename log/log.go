// Package log は Binder のログ。Binder のコードはここの関数でログを出す（標準の log・slog・wenteasy/log を直接使わない）。
// 中身は github.com/wenteasy/log に任せ、ここではアプリの出口（setup.go）・レベル・出す関数だけを持つ。
// 作り方は wenteasy/log の README「使う側のやり方（自分の log パッケージを作る）」のひな形に揃えている。
//
// 出す関数は slog と同じ「メッセージ + キーと値」（Info）と printf（Infof）の 2 つ。
// 出口は slog.Default() なので、slog で直接書いたログも同じ出口へ出る。
package log

import (
	"context"
	"fmt"
	"log/slog"
	"runtime"
	"time"

	wlog "github.com/wenteasy/log"
)

// 値は wenteasy/log と同じ。型は slog.Level（debug = -4 ,info = 0 warn = 4,error = 8）。
const (
	LevelTrace     = wlog.LevelTrace
	LevelDebug     = wlog.LevelDebug
	LevelInfo      = wlog.LevelInfo
	LevelNotice    = wlog.LevelNotice
	LevelWarn      = wlog.LevelWarn
	LevelError     = wlog.LevelError
	LevelEmergency = wlog.LevelEmergency
)

// logLevel は出口（ファイル・コンソール）のレベル。画面（ログビューア）から変える。
var logLevel slog.LevelVar

func init() {
	logLevel.Set(LevelNotice)
}

// SetLevel はログレベルを動的に変更する。
func SetLevel(level slog.Level) {
	logLevel.Set(level)
}

// GetLevel は現在のログレベルを返す。
func GetLevel() slog.Level {
	return logLevel.Level()
}

// Enabled は level のログが出るかを返す。引数を組み立てるのが重いときに先に確かめる。
func Enabled(level slog.Level) bool {
	return slog.Default().Enabled(context.Background(), level)
}

// 出す関数（メッセージ + キーと値）。log.Info("保存しました", "path", p)
func Trace(msg string, args ...any)  { output(LevelTrace, msg, "", nil, args) }
func Debug(msg string, args ...any)  { output(LevelDebug, msg, "", nil, args) }
func Info(msg string, args ...any)   { output(LevelInfo, msg, "", nil, args) }
func Notice(msg string, args ...any) { output(LevelNotice, msg, "", nil, args) }
func Warn(msg string, args ...any)   { output(LevelWarn, msg, "", nil, args) }
func Error(msg string, args ...any)  { output(LevelError, msg, "", nil, args) }

// 出す関数（printf）。log.Warnf("失敗:\n%+v", err)
func Tracef(format string, args ...any)  { output(LevelTrace, "", format, args, nil) }
func Debugf(format string, args ...any)  { output(LevelDebug, "", format, args, nil) }
func Infof(format string, args ...any)   { output(LevelInfo, "", format, args, nil) }
func Noticef(format string, args ...any) { output(LevelNotice, "", format, args, nil) }
func Warnf(format string, args ...any)   { output(LevelWarn, "", format, args, nil) }
func Errorf(format string, args ...any)  { output(LevelError, "", format, args, nil) }

// runtime.Callers → output → 公開関数 → 呼び出し元。
// ⚠️ output は公開関数から直接呼ぶ（間に関数を挟むと、記録される位置がずれる）。
const callerSkip = 3

func output(level slog.Level, msg, format string, fargs, attrs []any) {
	l := slog.Default()
	ctx := context.Background()
	if !l.Enabled(ctx, level) {
		return // 出さないレベルなら Sprintf もしない
	}
	if format != "" {
		msg = fmt.Sprintf(format, fargs...)
	}
	var pcs [1]uintptr
	runtime.Callers(callerSkip, pcs[:])
	r := slog.NewRecord(time.Now(), level, msg, pcs[0])
	r.Add(attrs...)
	_ = l.Handler().Handle(ctx, r)
}

// 以下は wenteasy/log のものを変数で指す（包むと記録される位置が包んだ関数になる）。

// 関数の出入り。defer log.PrintTrace(log.Func("Name()", args...)) で使う。
var (
	Func       = wlog.Func
	PrintTrace = wlog.PrintTrace
)

// PrintStackTrace は err を "%+v" で Error に出す。
var PrintStackTrace = wlog.PrintStackTrace

// NoneStop は panic を拾って Emergency で記録し、そこで止める（defer log.NoneStop()）。
// recover は defer された関数の中で直接呼ばないと効かないため、包まずに wenteasy/log のものを指す。
var NoneStop = wlog.NoneStop
