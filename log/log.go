// Package log は Binder のログ。中身は github.com/wenteasy/log に任せ、
// ここではアプリの出口（日ごとのファイル・ハンドラ・レベル）だけを持つ。
//
// 出す関数（Trace〜Error）は printf の形で、wenteasy/log の Tracef などをそのまま指している。
// 関数で包まないのは、記録される呼び出し元の位置が包んだ関数（このパッケージ）にならないようにするため。
// 出口は slog.Default() なので、slog で直接書いたログも同じファイルへ出る。
package log

import (
	"log/slog"
	"os"
	"path/filepath"

	wlog "github.com/wenteasy/log"
)

// debug = -4 ,info = 0 warn = 4,error = 8

const (
	LevelTrace     = wlog.LevelTrace
	LevelNotice    = wlog.LevelNotice
	LevelEmergency = wlog.LevelEmergency
)

var writer *wlog.RollingFileWriter
var logLevel slog.LevelVar

func init() {
	logLevel.Set(LevelNotice)
}

// Init はログファイルを temp ディレクトリの binder/ に日ごと（20060102.log）に作り、slog を設定する。
// ファイルは最初に書いたときに開き、日付が変わると次のファイルへ切り替わる。
func Init() (*slog.Logger, error) {
	w, err := wlog.NewRollingFileWriter(filepath.Join(os.TempDir(), "binder"), wlog.Day)
	if err != nil {
		return nil, err
	}
	writer = w

	logger := slog.New(wlog.NewSimpleHandler(writer, &logLevel))
	slog.SetDefault(logger)

	return logger, nil
}

// Close はログファイルを閉じる。
func Close() {
	if writer != nil {
		writer.Close()
		writer = nil
	}
}

// Path は現在のログファイルのパスを返す。
// Init が未呼び出し、またはまだ 1 件も書いていない場合は空文字を返す。
func Path() string {
	if writer == nil {
		return ""
	}
	return writer.Path()
}

// SetLevel はログレベルを動的に変更する。
func SetLevel(level slog.Level) {
	logLevel.Set(level)
}

// GetLevel は現在のログレベルを返す。
func GetLevel() slog.Level {
	return logLevel.Level()
}

// 出す関数（printf の形）。
var (
	Trace  = wlog.Tracef
	Debug  = wlog.Debugf
	Info   = wlog.Infof
	Notice = wlog.Noticef
	Warn   = wlog.Warnf
	Error  = wlog.Errorf
)

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
