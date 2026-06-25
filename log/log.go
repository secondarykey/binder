package log

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// debug = -4 ,info = 0 warn = 4,error = 8

const (
	LevelTrace     slog.Level = -8
	LevelNotice    slog.Level = 2
	LevelEmergency slog.Level = 32
)

var gCtx context.Context
var gLogger *slog.Logger
var logFile *os.File
var logLevel slog.LevelVar

func init() {
	gCtx = context.Background()
	logLevel.Set(LevelNotice)
	gLogger = slog.Default()
}

// Init はログファイルを temp ディレクトリに作成し、slog を設定する。
func Init() (*slog.Logger, error) {
	dir := filepath.Join(os.TempDir(), "binder")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	name := time.Now().Format("20060102") + ".log"
	f, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}
	logFile = f

	handler := &simpleHandler{w: logFile, level: &logLevel}
	logger := slog.New(handler)
	slog.SetDefault(logger)
	gLogger = logger

	//Notice(fmt.Sprintf("Log Level:%v", levelName(logLevel)))

	return gLogger, nil
}

// simpleHandler はデフォルトの log パッケージに近いシンプルな出力を行う slog.Handler。
// 出力形式: 2006/01/02 15:04:05 [LEVEL] message
type simpleHandler struct {
	w     io.Writer
	level *slog.LevelVar
}

func (h *simpleHandler) Enabled(_ context.Context, l slog.Level) bool {
	return l >= h.level.Level()
}

func (h *simpleHandler) Handle(_ context.Context, r slog.Record) error {
	t := r.Time.Format(time.RFC3339)
	_, err := fmt.Fprintf(h.w, "%s [%-6s] %s\n", t, levelName(r.Level), r.Message)
	return err
}

func (h *simpleHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *simpleHandler) WithGroup(_ string) slog.Handler      { return h }

func levelName(l slog.Level) string {
	switch {
	case l <= LevelTrace:
		return "TRACE"
	case l <= slog.LevelDebug:
		return "DEBUG"
	case l < LevelNotice:
		return "INFO"
	case l < slog.LevelWarn:
		return "NOTICE"
	case l < slog.LevelError:
		return "WARN"
	case l < LevelEmergency:
		return "ERROR"
	default:
		return "EMERGENCY"
	}
}

// Close はログファイルを閉じる。
func Close() {
	if logFile != nil {
		logFile.Close()
		logFile = nil
	}
}

// Path は現在のログファイルのパスを返す。
// Init が未呼び出しの場合は空文字を返す。
func Path() string {
	if logFile == nil {
		return ""
	}
	return logFile.Name()
}

// SetLevel はログレベルを動的に変更する。
func SetLevel(level slog.Level) {
	logLevel.Set(level)
}

// GetLevel は現在のログレベルを返す。
func GetLevel() slog.Level {
	return logLevel.Level()
}

func SetContext(ctx context.Context) {
	gCtx = ctx
}

func Trace(msg string, args ...interface{}) {
	log(LevelTrace, msg, args...)
}

func Debug(msg string, args ...interface{}) {
	log(slog.LevelDebug, msg, args...)
}

func Info(msg string, args ...interface{}) {
	log(slog.LevelInfo, msg, args...)
}

func Notice(msg string, args ...interface{}) {
	log(LevelNotice, msg, args...)
}

func Warn(msg string, args ...interface{}) {
	log(slog.LevelWarn, msg, args...)
}

func Error(msg string, args ...interface{}) {
	log(slog.LevelError, msg, args...)
}

func log(lv slog.Level, msg string, args ...interface{}) {
	put(gCtx, lv, msg, args...)
}

func put(ctx context.Context, lv slog.Level, format string, args ...interface{}) {
	if gLogger.Enabled(ctx, lv) {
		msg := fmt.Sprintf(format, args...)
		slog.Log(ctx, lv, msg)
	}
}

func PrintTrace(caller string) {
	Trace("%s %s", caller, "End")
}

func Func(caller string, args ...interface{}) string {
	Trace("%s %s", caller, "Start")
	if len(args) > 0 {
		Trace("Arguments:%s", arguments(args...))
	}
	return caller
}

func arguments(args ...interface{}) string {
	var buf strings.Builder
	for idx, a := range args {
		if idx != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("%v", a))
	}
	return buf.String()
}

func PrintStackTrace(err error) {
	Error("Error:%+v", err)
	return
}

func NoneStop() {
	if err := recover(); err != nil {
		emergency(err)
	}
}

func emergency(err interface{}) {
	//0.this
	//1.emergency
	//2.defer
	//3. panic!
	_, file, line, ok := runtime.Caller(3)
	put(gCtx, LevelEmergency, "Emergency!!\n%+v", err)
	if ok {
		put(gCtx, LevelEmergency, "File:%s", file)
		put(gCtx, LevelEmergency, "Line:%d", line)
	}
}
