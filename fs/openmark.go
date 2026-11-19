package fs

import (
	"binder/log"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"
	"golang.org/x/xerrors"
)

// 「このバインダーを開いている」印（open marker）。
//
// アプリがバインダーを開いている間、.git/ に次の 2 つを置く:
//
//   - OpenLockName（binder-open.lock）— OS のファイルロックを掛けたまま開いておく。
//     ロックが取れるかどうかが「開いているか」の正。プロセスが落ちれば OS が外すので、
//     クラッシュで古い印が残っても「開いている」とは判定されない
//   - OpenInfoName（binder-open.json）— 誰が開いているかの情報（OpenInfo）。表示用で判定には使わない
//
// .git/ に置くのは、記録・複製・git status のどれにも出ないため。
// 外部のツール（binder-organize スキルの Preflight 等）はロックファイルを
// 排他で開けるかどうかで、アプリが開いているかを判定する。
//
// 同じプロセスの中では参照カウントで扱う。ByPath 系の API は、アプリが開いている
// バインダーをもう一度 binder.Load() することがあるため、ロックを取り直さずに数だけ増やす。
const (
	OpenLockName = "binder-open.lock"
	OpenInfoName = "binder-open.json"
)

// ErrOpenedElsewhere は別のプロセス（もう一つの Binder 等）がバインダーを開いているときのエラー。
// AcquireOpen は *OpenedElsewhereError で返す（errors.Is でこれに当たる）。
var ErrOpenedElsewhere = errors.New("binder is opened by another process")

// OpenedElsewhereError は、どのバインダーが別のプロセスで開かれているかを持つ。
// 起動時に前回のバインダーを自動で開くと、画面からはどのバインダーのことか分からないため、
// API 層がこの Dir（バインダーのパス）をメッセージに入れる。
type OpenedElsewhereError struct {
	Dir  string    // バインダーのディレクトリ（AcquireOpen に渡されたもの）
	Info *OpenInfo // 開いている側の情報。読めなければ nil
}

func (e *OpenedElsewhereError) Error() string {
	return fmt.Sprintf("%v: %s (%s)", ErrOpenedElsewhere, e.Dir, describeOpenInfo(e.Info))
}

func (e *OpenedElsewhereError) Unwrap() error {
	return ErrOpenedElsewhere
}

// OpenInfo は binder-open.json の中身。
type OpenInfo struct {
	PID      int       `json:"pid"`
	Host     string    `json:"host"`
	App      string    `json:"app"`
	OpenedAt time.Time `json:"openedAt"`
}

type openEntry struct {
	file  *os.File
	git   string
	count int
}

var (
	openMu      sync.Mutex
	openEntries = map[string]*openEntry{}
)

// openKey は同じバインダーを同じキーで引けるようにパスを正規化する。
func openKey(dir string) string {
	p, err := filepath.Abs(dir)
	if err != nil {
		p = dir
	}
	p = filepath.Clean(p)
	if runtime.GOOS == "windows" {
		p = strings.ToLower(p)
	}
	return p
}

// AcquireOpen はバインダーを開いている印を立てる。ReleaseOpen と対で呼ぶ。
//
// 別のプロセスが開いていれば ErrOpenedElsewhere を返す。
// .git が無いディレクトリでは何もしない（バインダーではないので、呼び出し側の Load が失敗する）。
func AcquireOpen(dir string) error {

	key := openKey(dir)

	openMu.Lock()
	defer openMu.Unlock()

	if e, ok := openEntries[key]; ok {
		e.count++
		return nil
	}

	gitDir := filepath.Join(dir, git.GitDirName)
	if st, err := os.Stat(gitDir); err != nil || !st.IsDir() {
		return nil
	}

	lockPath := filepath.Join(gitDir, OpenLockName)
	f, err := os.OpenFile(lockPath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return xerrors.Errorf("os.OpenFile(%s) error: %w", lockPath, err)
	}

	if err := tryLock(f); err != nil {
		f.Close()
		if errors.Is(err, errLocked) {
			info, _ := ReadOpenInfo(dir)
			return xerrors.Errorf("AcquireOpen() error: %w", &OpenedElsewhereError{Dir: dir, Info: info})
		}
		return xerrors.Errorf("tryLock(%s) error: %w", lockPath, err)
	}

	// 情報の書き込みは失敗しても続ける（判定はロックで行うため）
	if err := writeOpenInfo(gitDir); err != nil {
		log.Warnf("binder-open.json の書き込みに失敗（開くのは続けます）:\n%+v", err)
	}

	openEntries[key] = &openEntry{file: f, git: gitDir, count: 1}
	return nil
}

// IsOpenedElsewhere は、別のプロセスが dir を開いている（ロックを持っている）かを返す。
// 読み取り専用で開いているときに、相手が閉じたかを確かめるのに使う。
//
// 印を立てずにロックを試し、取れたらすぐ外す。ロックファイルが無ければ誰も開いていない
// （最後の ReleaseOpen が消す）ので、作らずに false を返す。このプロセスが印を持っていれば false。
func IsOpenedElsewhere(dir string) (bool, error) {
	if holdsOpen(dir) {
		return false, nil
	}
	lockPath := filepath.Join(dir, git.GitDirName, OpenLockName)
	f, err := os.OpenFile(lockPath, os.O_RDWR, 0)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, xerrors.Errorf("os.OpenFile(%s) error: %w", lockPath, err)
	}
	defer f.Close()

	if err := tryLock(f); err != nil {
		if errors.Is(err, errLocked) {
			return true, nil
		}
		return false, xerrors.Errorf("tryLock(%s) error: %w", lockPath, err)
	}
	if err := unlock(f); err != nil {
		log.Warnf("binder-open.lock のロック解除に失敗:\n%+v", err)
	}
	return false, nil
}

// holdsOpen は、このプロセスが dir の「開いている」印を持っているかを返す。
// 持っていなければ、別のプロセスがそのバインダーを開いて書いている最中かもしれない。
func holdsOpen(dir string) bool {
	key := openKey(dir)
	openMu.Lock()
	defer openMu.Unlock()
	_, ok := openEntries[key]
	return ok
}

// ReleaseOpen は AcquireOpen で立てた印を下ろす。最後の 1 つで印のファイルを消す。
func ReleaseOpen(dir string) {

	key := openKey(dir)

	openMu.Lock()
	defer openMu.Unlock()

	e, ok := openEntries[key]
	if !ok {
		return
	}
	e.count--
	if e.count > 0 {
		return
	}
	delete(openEntries, key)

	// 情報を先に消し、ロックを外してからロックファイルを消す。
	// Windows では開いているファイルは消せないため、閉じてから消す。
	// 消せなくても（他のプロセスが覗いている瞬間など）、ロックが外れていれば「開いていない」と判定される
	infoPath := filepath.Join(e.git, OpenInfoName)
	if err := os.Remove(infoPath); err != nil && !os.IsNotExist(err) {
		log.Warnf("binder-open.json の削除に失敗:\n%+v", err)
	}
	if err := unlock(e.file); err != nil {
		log.Warnf("binder-open.lock のロック解除に失敗:\n%+v", err)
	}
	lockPath := e.file.Name()
	if err := e.file.Close(); err != nil {
		log.Warnf("binder-open.lock を閉じられません:\n%+v", err)
	}
	if err := os.Remove(lockPath); err != nil && !os.IsNotExist(err) {
		log.Warnf("binder-open.lock の削除に失敗:\n%+v", err)
	}
}

func writeOpenInfo(gitDir string) error {
	host, _ := os.Hostname()
	app := ""
	if exe, err := os.Executable(); err == nil {
		app = filepath.Base(exe)
	}
	info := OpenInfo{
		PID:      os.Getpid(),
		Host:     host,
		App:      app,
		OpenedAt: time.Now(),
	}
	buf, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return xerrors.Errorf("json.MarshalIndent() error: %w", err)
	}
	p := filepath.Join(gitDir, OpenInfoName)
	if err := os.WriteFile(p, buf, 0644); err != nil {
		return xerrors.Errorf("os.WriteFile(%s) error: %w", p, err)
	}
	return nil
}

// ReadOpenInfo は binder-open.json を読む。無ければ nil を返す。
func ReadOpenInfo(dir string) (*OpenInfo, error) {
	p := filepath.Join(dir, git.GitDirName, OpenInfoName)
	buf, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, xerrors.Errorf("os.ReadFile(%s) error: %w", p, err)
	}
	var info OpenInfo
	if err := json.Unmarshal(buf, &info); err != nil {
		return nil, xerrors.Errorf("json.Unmarshal(%s) error: %w", p, err)
	}
	return &info, nil
}

func describeOpenInfo(info *OpenInfo) string {
	if info == nil {
		return "unknown process"
	}
	return fmt.Sprintf("pid=%d host=%s since=%s", info.PID, info.Host, info.OpenedAt.Format(time.RFC3339))
}
