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
	TraceLevel     slog.Level = -8
	NoticeLevel    slog.Level = 2
	EmergencyLevel slog.Level = 32
)

var gCtx context.Context
var def *slog.Logger
var logFile *os.File
var logLevel slog.LevelVar

func init() {
	gCtx = context.Background()
	logLevel.Set(NoticeLevel)
	def = slog.Default()
}

// Init はログファイルを temp ディレクトリに作成し、
// stdout とファイルの両方に出力するよう slog を設定する。
func Init() error {
	dir := filepath.Join(os.TempDir(), "binder")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	name := time.Now().Format("20060102") + ".log"
	f, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	logFile = f

	w := io.MultiWriter(os.Stdout, logFile)
	handler := &simpleHandler{w: w, level: &logLevel}
	logger := slog.New(handler)
	slog.SetDefault(logger)
	def = logger

	return nil
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
	t := r.Time.Format("2006/01/02 15:04:05")
	_, err := fmt.Fprintf(h.w, "%s [%s] %s\n", t, levelName(r.Level), r.Message)
	return err
}

func (h *simpleHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *simpleHandler) WithGroup(_ string) slog.Handler      { return h }

func levelName(l slog.Level) string {
	switch {
	case l <= TraceLevel:
		return "TRACE"
	case l <= slog.LevelDebug:
		return "DEBUG"
	case l < NoticeLevel:
		return "INFO"
	case l < slog.LevelWarn:
		return "NOTICE"
	case l < slog.LevelError:
		return "WARN"
	case l < EmergencyLevel:
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

func Trace(msg string) {
	//Handler.Enabled(ctx,Level)
	//defer binder.Trace(binder.Start("Trace"))
	slog.Log(gCtx, TraceLevel, msg)
}

func Notice(msg string) {
	slog.Log(gCtx, NoticeLevel, msg)
}

func PrintTrace(caller string) {
	if def.Enabled(gCtx, TraceLevel) {
		Trace(caller + " End")
	}
}

func Func(caller string, args ...interface{}) string {
	if def.Enabled(gCtx, TraceLevel) {
		//pc,file,line,ok  := runtime.Caller(1)
		Trace(caller + " Start")
		if len(args) > 0 {
			Trace("Arguments:" + arguments(args...))
		}
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
	slog.Error("Exception:\n" + stacktrace(err))
	return
}

func NoneStop() {
	if err := recover(); err != nil {
		emergency(err)
	}
}

func stacktrace(err interface{}) string {
	return fmt.Sprintf("%+v", err)
}

func emergency(err interface{}) {
	//0.this
	//1.emergency
	//2.defer
	//3. panic!
	_, file, line, ok := runtime.Caller(3)
	slog.Log(gCtx, EmergencyLevel, "Emergency!!\n"+stacktrace(err))
	if ok {
		slog.Log(gCtx, EmergencyLevel, "File:"+file)
		slog.Log(gCtx, EmergencyLevel, fmt.Sprintf("Line:%d", line))
	}
}
