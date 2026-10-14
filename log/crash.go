package log

import (
	"io"
	"os"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"

	"golang.org/x/xerrors"
)

// 異常終了（拾われなかった panic・Go のランタイムの致命的なエラー）の記録。
//
// 配る exe（-H windowsgui）では、panic の内容は標準エラー出力にしか出ず、どこにも残らない。
// 利用者からは「何も言わずに消えた」にしか見えないので、ログと同じフォルダのファイルにも書かせる。
// 形は ikkyoku・aibow の log の CatchCrash と同じだが、Binder は複数のプロセス（Binder を 2 つ・Binder と Lite）が
// 同じフォルダを使うので、書き出し先をプロセスごとに分ける（同じファイルだと、あとから起動したほうが前の記録を消してしまう）。
//
// 画面から呼ばれたメソッドの中の panic は Wails が recover してログに Error で書くので、ここには来ない。

// crashPrefix は書き出し先の名前の頭。
//   - 書いている間: binder_crash_pid<プロセスID>.log（正常に終わったら消す）
//   - 前回の記録: binder_crash_<日時>.log（次の起動で改名して残す）
const crashPrefix = FilePrefix + "_crash_"

const crashPIDMark = "pid"

// CatchCrash は、以後の異常終了の内容を dir のファイルにも書かせる（標準エラー出力にも、これまでどおり出る）。
// 前回までの記録が残っていれば binder_crash_<日時>.log に改名して残し、その場所を返す（= 異常終了したプロセスがあった）。
// Init のあとに 1 回だけ呼ぶ（アプリの main）。返す io.Closer は正常に終わるときに閉じる（記録の準備を片付ける）。nil にしない。
//
// 書けなくても起動は止めないこと。エラーを返すだけ。
func CatchCrash(dir string) (io.Closer, []string, error) {
	if dir == "" {
		return nopCloser{}, nil, xerrors.New("ログを書くフォルダが無いので、異常終了の記録を残せません")
	}
	previous := keepPreviousCrashes(dir)

	path := filepath.Join(dir, crashPrefix+crashPIDMark+strconv.Itoa(os.Getpid())+".log")
	f, err := os.Create(path)
	if err != nil {
		return nopCloser{}, previous, xerrors.Errorf("異常終了の記録 %s を作れません: %w", path, err)
	}
	// SetCrashOutput はファイルの記述子を複製して持つので、ここで閉じてよい。
	defer f.Close()
	if err := debug.SetCrashOutput(f, debug.CrashOptions{}); err != nil {
		os.Remove(path)
		return nopCloser{}, previous, xerrors.Errorf("debug.SetCrashOutput() error: %w", err)
	}
	return crashCloser(path), previous, nil
}

// crashCloser は正常に終わるときに書き出し先を放して消す（空のまま残すと、次の起動で前回の記録と区別できない）。
type crashCloser string

func (c crashCloser) Close() error {
	// 放さないと Windows では消せない
	if err := debug.SetCrashOutput(nil, debug.CrashOptions{}); err != nil {
		return err
	}
	return os.Remove(string(c))
}

// keepPreviousCrashes は、中身のある書き出し先（binder_crash_pid*.log）を書かれた時刻の名前
// （binder_crash_20261015-173000.log）に改名して返す。
//
// 中身があるのは異常終了したプロセスのものだけ（書かれるのは落ちるときだけ）。
// 空のものは、動いている別のプロセスのもの（または強制終了で消せなかったもの）なので触らない。
// 改名すること（消さない・上書きしない）。
func keepPreviousCrashes(dir string) []string {
	paths, err := filepath.Glob(filepath.Join(dir, crashPrefix+crashPIDMark+"*.log"))
	if err != nil {
		return nil
	}
	var kept []string
	for _, path := range paths {
		st, err := os.Stat(path)
		if err != nil || st.Size() == 0 {
			continue
		}
		name := crashPrefix + st.ModTime().Format("20060102-150405")
		dst := filepath.Join(dir, name+".log")
		// 同じ秒に複数のプロセスが落ちたときは、プロセス ID を足して分ける
		if _, err := os.Stat(dst); err == nil {
			pid := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(path), crashPrefix+crashPIDMark), ".log")
			dst = filepath.Join(dir, name+"_"+pid+".log")
		}
		if err := os.Rename(path, dst); err != nil {
			continue
		}
		kept = append(kept, dst)
	}
	return kept
}
