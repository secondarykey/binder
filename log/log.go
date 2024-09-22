package log

import (
	"context"
	"fmt"
	"log/slog"
	"runtime"
	"strings"
)

// debug = -4 ,info = 0 warn = 4,error = 8

const (
	TraceLevel     slog.Level = -8
	NoticeLevel    slog.Level = 2
	EmergencyLevel slog.Level = 32
)

var gCtx context.Context
var def *slog.Logger

func init() {
	slog.SetLogLoggerLevel(TraceLevel)
	gCtx = context.Background()
	def = slog.Default()
}

func SetContext(ctx context.Context) {
	gCtx = ctx
}

func Trace(caller string, args ...interface{}) {
	//Handler.Enabled(ctx,Level)
	//defer binder.Trace(binder.Start("Trace"))
	slog.Log(gCtx, TraceLevel, caller, args...)
}

func Noticef(msg string, args ...interface{}) {
	slog.Log(gCtx, NoticeLevel, msg, args...)
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
