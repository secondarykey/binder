package binder

import (
	. "binder/internal"

	"binder/api/json"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"binder/setup/convert"

	"fmt"
	"time"

	"github.com/go-git/go-git/v5/plumbing"
	"golang.org/x/xerrors"
)

// Repository は、バインダーを開かずに（DB を読まずに）ディレクトリの git リポジトリへ
// 直接行う操作をまとめたもの。
//
// 使う場面は 2 つ:
//   - 開いているバインダーをいったん閉じて行う操作（取り込み・復元・ブランチ切替・履歴の整理）。
//     これらは作業ツリーや pack を丸ごと入れ替えるので、DB を開いたままではできない。
//     閉じる・開き直すのは呼び出し側（api.App）が行う
//   - バインダーを開いていない状態での操作（移行に失敗して開けないバインダーの履歴・ブランチ）
//
// api パッケージは fs.Load を直接呼ばず、ここを通す。
type Repository struct {
	dir string
	fs  *fs.FileSystem
	// locked は LockRepository で「開いている」印を立てたかどうか
	locked bool
}

// OpenRepository は dir のリポジトリを開く。「開いている」印には触らない
// （読むだけの操作か、呼び出し側が印を持っているとき用）。
func OpenRepository(dir string) (*Repository, error) {
	f, err := fs.Load(dir)
	if err != nil {
		// 呼び出し側がメッセージをそのまま画面に出すことがあるので包まない
		return nil, err
	}
	return &Repository{dir: dir, fs: f}, nil
}

// LockRepository は「開いている」印を立ててから dir のリポジトリを開く。
// 別のプロセスが開いていればエラーになる。バインダーを開いていない状態で書き込むとき用。
// 使い終わったら Close で印を外す。
func LockRepository(dir string) (*Repository, error) {
	if err := fs.AcquireOpen(dir); err != nil {
		return nil, err
	}
	r, err := OpenRepository(dir)
	if err != nil {
		fs.ReleaseOpen(dir)
		return nil, err
	}
	r.locked = true
	return r, nil
}

// Close は LockRepository で立てた印を外す。OpenRepository で開いたものには何もしない。
func (r *Repository) Close() {
	if r.locked {
		fs.ReleaseOpen(r.dir)
		r.locked = false
	}
}

// --- 履歴・ブランチ ---

// RestoreToCommit は指定コミットの状態に復元する。
func (r *Repository) RestoreToCommit(hash string) error {
	return r.fs.RestoreToCommit(hash)
}

// SwitchBranch は指定ブランチに切り替える。
func (r *Repository) SwitchBranch(name string) error {
	return r.fs.CheckoutBranch(name)
}

// DiscardChanges は未記録の変更を捨てる（git reset --hard HEAD）。
// 移行に失敗したあとなど、作業ツリーが汚れたままブランチを切り替えると
// 変更が切替先に持ち込まれるので、その前に呼ぶ。
func (r *Repository) DiscardChanges() error {
	return r.fs.ResetHard()
}

// CreateBranch はブランチを作って切り替える。
func (r *Repository) CreateBranch(name string) error {
	return r.fs.Branch(name)
}

// ListBranches はブランチ一覧を返す。
func (r *Repository) ListBranches() ([]string, error) {
	return r.fs.ListBranches()
}

// CurrentBranch は現在のブランチ名を返す。
func (r *Repository) CurrentBranch() (string, error) {
	return r.fs.CurrentBranch()
}

// SquashHistory は before より古い履歴を圧縮する。
func (r *Repository) SquashHistory(before time.Time) (*fs.SquashResult, error) {
	return r.fs.SquashHistory(before)
}

// GC は不要な git オブジェクトを削除する。
func (r *Repository) GC() *fs.GCResult {
	return r.fs.GC()
}

// OverallHistoryByPath は、バインダーを開いていない dir の全体履歴を返す。
// まずバインダーとして開き、開けなければ（移行前・壊れているなど）リポジトリだけを読む。
func OverallHistoryByPath(dir string, limit, offset int) ([]*fs.CommitInfo, bool, error) {
	b, err := Load(dir)
	if err == nil {
		defer b.Close()
		return b.GetOverallHistory(limit, offset)
	}

	log.Warnf("binder.Load() failed, falling back to fs.Load():\n%+v", err)
	r, err := OpenRepository(dir)
	if err != nil {
		return nil, false, err
	}
	return r.fs.GetOverallHistory(limit, offset)
}

// CommitFileEntriesByPath は、バインダーを開いていない dir のコミットのファイル一覧を返す。
// バインダーとして開ければ名前を解決し、開けなければ ID をそのまま名前にする。
func CommitFileEntriesByPath(dir string, hash string) ([]*json.CommitFileEntry, error) {
	b, err := Load(dir)
	if err == nil {
		defer b.Close()
		return b.GetCommitFileEntries(hash)
	}

	log.Warnf("binder.Load() failed, falling back to fs.Load():\n%+v", err)
	r, err := OpenRepository(dir)
	if err != nil {
		return nil, err
	}
	files, err := r.fs.GetCommitFiles(hash)
	if err != nil {
		return nil, err
	}
	return commitFileEntries(files, nil), nil
}

// GetCommitFileEntries はコミットのファイル一覧を、名前を解決して返す。
func (b *Binder) GetCommitFileEntries(hash string) ([]*json.CommitFileEntry, error) {
	files, err := b.GetCommitFiles(hash)
	if err != nil {
		return nil, err
	}
	return commitFileEntries(files, b), nil
}

// commitFileEntries は CommitFile を画面向けの形にする。
// b があればノート・ダイアグラムなどの名前を Structure から引く。無ければ ID のまま。
func commitFileEntries(files []*fs.CommitFile, b *Binder) []*json.CommitFileEntry {
	entries := make([]*json.CommitFileEntry, len(files))
	for i, f := range files {
		name := f.Id
		if b != nil {
			switch f.Typ {
			case "database", "publish", "other", "asset":
				// ID（パス）をそのまま出す
			default:
				if s, err := b.GetStructure(f.Id); err == nil && s.Name != "" {
					name = s.Name
				}
			}
		}
		entries[i] = &json.CommitFileEntry{
			Typ:    f.Typ,
			Id:     f.Id,
			Action: f.Action,
			Name:   name,
		}
	}
	return entries
}

// --- 取り込み（マージ） ---

// MergeSource は取り込み元。RemoteName があればリモートのブランチ、無ければローカルのブランチ。
type MergeSource struct {
	// リモートから取り込むとき（事前に Fetch しておく）
	RemoteName   string
	RemoteBranch string
	// ローカルのブランチから取り込むとき
	LocalBranch string
}

func (s MergeSource) isRemote() bool {
	return s.RemoteName != ""
}

// 取り込みの結果（MergeOutcome.Status）。
// これ以外に fs.MergeFFOnly / MergeFFOnlyLocal の返す値がそのまま入る
// （早送りできた "success"・すでに最新 "uptodate"）。
const (
	// MergeApplied は分岐していたものを衝突なしで取り込んだ。Analysis と Log に内容が入る。
	// 早送りの "success" とは別の値にしてある（早送りには Analysis も後始末も無い）
	MergeApplied = "applied"
	// MergeConflicts は衝突があり、ユーザの選択待ち。Analysis に内容が入る。まだ何も書き込んでいない
	MergeConflicts = "conflicts"
	// MergeVersionNewer は取り込み元がアプリより新しく、取り込めない。何も書き込んでいない
	MergeVersionNewer = "version_error"
)

// MergeOutcome は Repository.Merge の結果。
type MergeOutcome struct {
	Status string
	// Analysis は衝突の分析（MergeApplied / MergeConflicts のとき）
	Analysis *fs.MergeAnalysis
	// Log は取り込んだ内容（MergeApplied のとき。nil のこともある）。
	// 開き直したあと Binder.FinishMerge に渡すと、取り込みログのノートになる
	Log *fs.MergeLog
}

// Merge は取り込み元を現在のブランチへ取り込む。
//
// 流れ: 取り込み元のバージョンを確かめ（新しすぎれば MergeVersionNewer、古ければその場で移行）→
// 早送りできればする → 分岐していれば衝突を調べ、衝突が無ければそのまま取り込む（MergeApplied）、
// あればユーザの選択待ち（MergeConflicts。選んだあと ApplyMergeResolution を呼ぶ）。
//
// エラーは包まずに返す（呼び出し側がメッセージをそのまま画面に出すため）。
func (r *Repository) Merge(src MergeSource, appVer *Version) (*MergeOutcome, error) {

	var sourceHash plumbing.Hash
	var err error
	if src.isRemote() {
		sourceHash, err = r.fs.RemoteBranchHash(src.RemoteName, src.RemoteBranch)
	} else {
		sourceHash, err = r.fs.LocalBranchHash(src.LocalBranch)
	}
	if err != nil {
		return nil, err
	}

	effectiveHash, versionNewer, err := r.checkMergeSourceVersion(sourceHash, appVer)
	if err != nil {
		return nil, err
	}
	if versionNewer {
		return &MergeOutcome{Status: MergeVersionNewer}, nil
	}

	var analysis *fs.MergeAnalysis

	if effectiveHash == sourceHash {
		// 移行不要: 早送りを試み、分岐していれば衝突を調べる
		var status string
		if src.isRemote() {
			status, err = r.fs.MergeFFOnly(src.RemoteName, src.RemoteBranch)
		} else {
			status, err = r.fs.MergeFFOnlyLocal(src.LocalBranch)
		}
		if err != nil {
			return nil, err
		}
		if status != "diverged" {
			return &MergeOutcome{Status: status}, nil
		}

		if src.isRemote() {
			analysis, err = r.fs.DetectConflicts(src.RemoteName, src.RemoteBranch)
		} else {
			analysis, err = r.fs.DetectConflictsFromLocalBranch(src.LocalBranch)
		}
		if err != nil {
			return nil, err
		}
	} else {
		// 移行あり: 移行後のコミットをハッシュで指定して衝突を調べる
		currentHash, err := r.fs.HeadHash()
		if err != nil {
			return nil, err
		}
		analysis, err = r.fs.DetectConflictsByHash(currentHash.String(), effectiveHash.String())
		if err != nil {
			return nil, err
		}
	}

	if len(analysis.Conflicts) > 0 {
		return &MergeOutcome{Status: MergeConflicts, Analysis: analysis}, nil
	}

	// 全て自動で解決できる → そのまま取り込む
	mergeLog, err := r.fs.ApplyResolutions(analysis, nil)
	if err != nil {
		return nil, err
	}
	src.fillLog(mergeLog)
	return &MergeOutcome{Status: MergeApplied, Analysis: analysis, Log: mergeLog}, nil
}

// ApplyMergeResolution は、衝突したファイルごとのユーザの選択を適用して取り込む。
// oursHash / theirsHash は Merge が返した Analysis のもの（衝突を調べ直して整合を確かめる）。
// src は取り込みログに残す取り込み元。
func (r *Repository) ApplyMergeResolution(src MergeSource, oursHash, theirsHash string, resolutions []fs.FileResolution) (*fs.MergeLog, error) {

	// リモート名・ブランチ名はハッシュから逆引きできないので、ハッシュで分析を作り直す
	analysis, err := r.fs.DetectConflictsByHash(oursHash, theirsHash)
	if err != nil {
		return nil, err
	}

	mergeLog, err := r.fs.ApplyResolutions(analysis, resolutions)
	if err != nil {
		return nil, err
	}
	src.fillLog(mergeLog)
	return mergeLog, nil
}

// fillLog は取り込みログに取り込み元を書く。
func (s MergeSource) fillLog(ml *fs.MergeLog) {
	if ml == nil {
		return
	}
	ml.RemoteName = s.RemoteName
	ml.RemoteBranch = s.RemoteBranch
	ml.SourceBranch = s.LocalBranch
}

// FinishMerge は、取り込んだあと開き直したバインダーで行う後始末。
// structure 行が失われた実体ファイルをツリーへ戻し、取り込みログのノートを作る。
// どちらも失敗しても取り込み自体は成功として扱う（ログに残すだけ）。
func (b *Binder) FinishMerge(mergeLog *fs.MergeLog) {

	restored, err := b.ReconcileMergedTree()
	if err != nil {
		log.Warnf("ReconcileMergedTree() error:\n%+v", err)
	}

	if mergeLog == nil {
		return
	}

	mergeLog.Restored = restored
	if branch, err := b.GetCurrentBranch(); err == nil {
		mergeLog.LocalBranch = branch
	}
	if err := b.CreateMergeLogNote(mergeLog); err != nil {
		log.Warnf("CreateMergeLogNote() error:\n%+v", err)
	}
}

// checkMergeSourceVersion は取り込み元のバージョンを確かめ、必要なら移行する。
// 戻り値:
//   - resultHash: 使うべきハッシュ（移行したら移行後のもの、不要なら sourceHash のまま）
//   - versionNewer: 取り込み元がアプリより新しい（バージョンアップを促す）
func (r *Repository) checkMergeSourceVersion(sourceHash plumbing.Hash, appVer *Version) (resultHash plumbing.Hash, versionNewer bool, err error) {
	meta, err := r.fs.ReadMetaFromHash(sourceHash)
	if err != nil {
		return sourceHash, false, xerrors.Errorf("ReadMetaFromHash() error: %w", err)
	}

	sourceVer, verErr := NewVersion(meta.Version)
	if verErr != nil {
		// パースできない場合は古いバインダーとして扱う
		sourceVer, _ = NewVersion("0.0.0")
	}

	// 取り込み元がアプリより新しい場合はバージョンアップが必要
	if sourceVer.Gt(appVer) {
		return sourceHash, true, nil
	}

	// 移行が不要な場合はそのまま返す
	if !convert.NeedsMigration(sourceVer) {
		return sourceHash, false, nil
	}

	// 最小サポートバージョン未満の取り込み元は移行できない（旧移行コードは削除済み）。
	// このエラーはメッセージがそのまま画面に出るため、翻訳済みのものを直接返す。
	minVer, minErr := NewVersion(convert.MinSupportedBinderVersion)
	if minErr == nil && sourceVer.Lt(minVer) {
		return sourceHash, false, fmt.Errorf("%s", settings.T("go.error.mergeSourceTooOld"))
	}

	// 移行が必要: その場で実行してハッシュを返す
	migratedHash, err := r.migrateSourceInPlace(sourceHash, appVer)
	if err != nil {
		return sourceHash, false, xerrors.Errorf("migrateSourceInPlace() error: %w", err)
	}

	return migratedHash, false, nil
}

// migrateSourceInPlace はデタッチドHEADで取り込み元をチェックアウトし、
// convert.Run() で移行して、移行後のコミットハッシュを返す。
// 処理後は元のブランチに戻す。移行コミットはリポジトリのオブジェクトストアに残り、
// ハッシュ経由でアクセスできる。
func (r *Repository) migrateSourceInPlace(sourceHash plumbing.Hash, appVer *Version) (plumbing.Hash, error) {
	currentBranch, err := r.fs.CurrentBranch()
	if err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("CurrentBranch() error: %w", err)
	}

	// 元のHEADハッシュを保存しておく（CheckoutBranch失敗時の強制復元用）
	currentHash, err := r.fs.HeadHash()
	if err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("HeadHash() error: %w", err)
	}

	if err := r.fs.CheckoutDetached(sourceHash); err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("CheckoutDetached() error: %w", err)
	}

	// エラー時も必ず元のブランチに戻す。
	// CheckoutBranch が失敗した場合は currentHash で強制チェックアウトし、
	// ワークツリーが不整合な状態で残らないようにする。
	defer func() {
		if restoreErr := r.fs.CheckoutBranch(currentBranch); restoreErr != nil {
			log.Warnf("migrateSourceInPlace: CheckoutBranch() error, forcing checkout to current hash:\n%+v", restoreErr)
			if forceErr := r.fs.CheckoutDetached(currentHash); forceErr != nil {
				log.Warnf("migrateSourceInPlace: force CheckoutDetached() also failed:\n%+v", forceErr)
			}
		}
	}()

	if _, err := convert.Run(r.dir, appVer); err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("convert.Run() error: %w", err)
	}

	migratedHash, err := r.fs.HeadHash()
	if err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("HeadHash() error: %w", err)
	}

	return migratedHash, nil
}
