// Package logging はアプリ（Binder / Binder Lite）のログの出口を組み立てる。
//
// ログを出す側は github.com/wenteasy/log（Info / Warnf / Func / PrintStackTrace など）か
// log/slog を使う。どちらも出口は slog.Default() で、Init がそこへ wenteasy/log の
// SimpleHandler を据える。このパッケージはアプリの main からだけ使う。
package logging

import (
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wenteasy/log"
	"golang.org/x/xerrors"
)

var level slog.LevelVar
var writer *log.RollingFileWriter

func init() {
	level.Set(log.LevelNotice)
}

// Init は temp ディレクトリの binder/ に日ごとのログファイル（20060102.log）を用意し、
// slog の既定の Logger をそこへ書くものに差し替える。
// ファイルは最初に書いたときに開き、日付が変わると次のファイルへ切り替わる。
func Init() (*slog.Logger, error) {
	w, err := log.NewRollingFileWriter(filepath.Join(os.TempDir(), "binder"), log.Day)
	if err != nil {
		return nil, xerrors.Errorf("log.NewRollingFileWriter() error: %w", err)
	}
	writer = w

	logger := slog.New(log.NewSimpleHandler(w, &level))
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

// Path は今書いているログファイルのパスを返す。
// Init が未呼び出し、またはまだ 1 件も書いていない場合は空文字を返す。
func Path() string {
	if writer == nil {
		return ""
	}
	return writer.Path()
}

// SetLevel はログレベルを動的に変更する。
func SetLevel(l slog.Level) {
	level.Set(l)
}

// GetLevel は現在のログレベルを返す。
func GetLevel() slog.Level {
	return level.Level()
}
