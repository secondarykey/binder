package api

import (
	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/log"

	"time"
)

func (a *App) CommitFiles(leafs []*json.Leaf, m string) error {

	files := make([]string, len(leafs))
	for idx, leaf := range leafs {
		f := a.current.ToFile(leaf.Type, leaf.Id)
		files[idx] = f
	}
	err := a.current.CommitFiles(m, files...)
	if err != nil {
		return userError(err)
	}
	return nil
}

// AutoSave は変更のある全エンティティを一括コミットする（自動保存）。
// バインダー未オープン時は何もせず 0 を返す。コミット件数を返す。
func (a *App) AutoSave() (int, error) {
	if a.current == nil {
		return 0, nil
	}
	n, err := a.current.AutoSave()
	if err != nil {
		log.PrintStackTrace(err)
		return 0, userError(err)
	}
	return n, nil
}

func (a *App) Commit(mode string, id string, m string) error {

	defer log.PrintTrace(log.Func("Commit()", id, mode))

	f := a.current.ToFile(mode, id)
	err := a.current.CommitFiles(m, f)
	if err != nil {
		return userError(err)
	}
	return nil
}

func (a *App) Remotes() ([]string, error) {

	defer log.PrintTrace(log.Func("Remotes()"))

	remotes, err := a.current.GetRemotes()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return remotes, nil
}

func (a *App) AddRemote(name string, url string) error {

	defer log.PrintTrace(log.Func("AddRemote()"))

	err := a.current.CreateRemote(name, url)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) CurrentBranch() (string, error) {

	defer log.PrintTrace(log.Func("CurrentBranch()"))

	name, err := a.current.GetCurrentBranch()
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return name, nil
}

func (a *App) RemoteList() ([]*json.Remote, error) {

	defer log.PrintTrace(log.Func("RemoteList()"))

	remotes, err := a.current.GetRemoteList()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return remotes, nil
}

func (a *App) EditRemote(name string, url string) error {

	defer log.PrintTrace(log.Func("EditRemote()"))

	err := a.current.EditRemote(name, url)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) DeleteRemote(name string) error {

	defer log.PrintTrace(log.Func("DeleteRemote()"))

	err := a.current.DeleteRemote(name)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) Push(remoteName string, info *json.UserInfo, save bool) error {

	defer log.PrintTrace(log.Func("Push()"))

	err := a.current.Push(remoteName, info, save)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) PushDocs(remoteName, publishBranch, subDir string, info *json.UserInfo, save bool) error {

	defer log.PrintTrace(log.Func("PushDocs()"))

	err := a.current.PushDocs(remoteName, publishBranch, subDir, info, save)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) ListRemoteBranches(url string, info *json.UserInfo) ([]string, error) {

	defer log.PrintTrace(log.Func("ListRemoteBranches()"))

	branches, err := fs.ListRemoteBranches(url, toFsUserInfo(info))
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return branches, nil
}

// toFsUserInfo は画面から受けた認証情報を fs の形にする。nil は nil のまま返す。
func toFsUserInfo(info *json.UserInfo) *fs.UserInfo {
	if info == nil {
		return nil
	}
	return &fs.UserInfo{
		Name:       info.Name,
		Email:      info.Email,
		AuthType:   fs.AuthType(info.AuthType),
		Username:   info.Username,
		Password:   info.Password,
		Token:      info.Token,
		Passphrase: info.Passphrase,
		Filename:   info.Filename,
		Bytes:      info.Bytes,
	}
}

// --- 閉じて→操作して→開き直す ---
//
// 取り込み・復元・ブランチ切替・履歴の整理は、作業ツリーや pack を丸ごと入れ替えるので
// DB を開いたままではできない。開いているバインダーを閉じ、リポジトリへ直接操作し
// （binder.Repository）、開き直す。操作の中身は binder パッケージ側にあり、
// ここは閉じる・開き直すことと、結果を画面向けの形にすることだけを行う。

// closedResult の Status。画面はこの値で分岐する。
const (
	// statusSuccess は操作も開き直しも成功
	statusSuccess = "success"
	// statusError は操作が失敗した（バインダーは開き直せた）
	statusError = "error"
	// statusReloadError は開き直せなかった（操作の成否にかかわらず）
	statusReloadError = "reload_error"
)

// closedResult は runClosed の結果。
type closedResult struct {
	Status  string
	Message string
	// Address は開き直したバインダーのアドレス（開き直せなかったら空）
	Address string
	// opErr は操作（リポジトリを開くところを含む）のエラー
	opErr error
	// reloadErr は開き直しのエラー
	reloadErr error
}

// runClosed は開いているバインダーを閉じ、リポジトリへ op を実行して、開き直す。
// op が失敗しても開き直す。閉じてから開き直すまでの間も「開いている」印は持ち続ける。
// 戻り値の error は「閉じられなかった」ときだけ（op は実行していない）。
func (a *App) runClosed(op func(repo *binder.Repository) error) (closedResult, error) {

	var res closedResult

	dir := a.current.Dir()
	defer a.holdOpen(dir)()

	if err := a.CloseBinder(); err != nil {
		log.PrintStackTrace(err)
		return res, err
	}

	repo, err := binder.OpenRepository(dir)
	if err == nil {
		err = op(repo)
	}
	if err != nil {
		log.PrintStackTrace(err)
		res.opErr = err
	}

	address, reloadErr := a.LoadBinder(dir)
	if reloadErr != nil {
		log.PrintStackTrace(reloadErr)
		res.reloadErr = reloadErr
	}

	switch {
	case res.reloadErr != nil:
		res.Status = statusReloadError
		res.Message = res.reloadErr.Error()
	case res.opErr != nil:
		res.Status = statusError
		res.Message = res.opErr.Error()
		res.Address = address
	default:
		res.Status = statusSuccess
		res.Address = address
	}
	return res, nil
}

// requireRecorded は未記録の変更があればエラーを返す（閉じて行う操作の前に確かめる）。
func (a *App) requireRecorded() error {
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return userError(err)
	}
	if len(ids) > 0 {
		return userError(ErrUncommittedChanges)
	}
	return nil
}

// --- 取り込み ---

func (a *App) MergeFromRemote(remoteName, remoteBranch string, info *json.UserInfo, save bool) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("MergeFromRemote()", remoteName, remoteBranch))

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	fsInfo := toFsUserInfo(info)

	// 認証情報の保存（オプション）
	if save {
		a.current.SaveUserInfo(fsInfo)
	}

	// Fetch は Binder を閉じる前に実行する（DB 操作を伴わない）
	err := a.current.Fetch(remoteName, remoteBranch, fsInfo)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	return a.merge(binder.MergeSource{RemoteName: remoteName, RemoteBranch: remoteBranch})
}

// MergeFromLocal はローカルブランチを現在のブランチにマージする。
func (a *App) MergeFromLocal(sourceBranch string) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("MergeFromLocal()", sourceBranch))

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	return a.merge(binder.MergeSource{LocalBranch: sourceBranch})
}

// merge は取り込みを実行し、結果を画面向けの形にする。取り込みの中身は binder.Repository.Merge。
func (a *App) merge(src binder.MergeSource) (*json.MergeResult, error) {

	var out *binder.MergeOutcome
	res, err := a.runClosed(func(repo *binder.Repository) (err error) {
		out, err = repo.Merge(src, a.version)
		return err
	})
	if err != nil {
		return nil, userError(err)
	}

	// 取り込み元がアプリより新しい: 開き直しに失敗していてもこの結果を返す
	if out != nil && out.Status == binder.MergeVersionNewer {
		return &json.MergeResult{Status: out.Status, Address: res.Address}, nil
	}

	if res.Status != statusSuccess {
		return &json.MergeResult{Status: res.Status, Message: res.Message, Address: res.Address}, nil
	}

	switch out.Status {
	case binder.MergeApplied:
		// 衝突なしで取り込んだ → ツリーの修復と取り込みログ
		a.current.FinishMerge(out.Log)
		return &json.MergeResult{
			Status:       statusSuccess,
			Address:      res.Address,
			AutoResolved: len(out.Analysis.AutoFiles),
		}, nil

	case binder.MergeConflicts:
		// 衝突あり → ユーザの選択を待つ（ApplyMergeResolution）
		analysis := out.Analysis
		conflicts := make([]*json.ConflictFile, len(analysis.Conflicts))
		for i, c := range analysis.Conflicts {
			conflicts[i] = &json.ConflictFile{
				Path:        c.Path,
				Type:        c.Type,
				Id:          c.Id,
				Name:        c.Name,
				OursAction:  c.OursAction,
				TheirAction: c.TheirAction,
			}
		}
		return &json.MergeResult{
			Status:       out.Status,
			Address:      res.Address,
			Conflicts:    conflicts,
			BaseHash:     analysis.BaseHash.String(),
			OursHash:     analysis.OursHash.String(),
			TheirsHash:   analysis.TheirsHash.String(),
			AutoResolved: len(analysis.AutoFiles),
		}, nil
	}

	// 早送りできた・すでに最新など（fs.MergeFFOnly の結果そのまま）
	return &json.MergeResult{Status: out.Status, Address: res.Address}, nil
}

func (a *App) ApplyMergeResolution(resolution *json.MergeResolution) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("ApplyMergeResolution()"))

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	src := binder.MergeSource{
		RemoteName:   resolution.RemoteName,
		RemoteBranch: resolution.RemoteBranch,
		LocalBranch:  resolution.SourceBranch,
	}

	fsResolutions := make([]fs.FileResolution, len(resolution.Resolutions))
	for i, r := range resolution.Resolutions {
		fsResolutions[i] = fs.FileResolution{
			Path:       r.Path,
			Resolution: r.Resolution,
		}
	}

	var mergeLog *fs.MergeLog
	res, err := a.runClosed(func(repo *binder.Repository) (err error) {
		mergeLog, err = repo.ApplyMergeResolution(src, resolution.OursHash, resolution.TheirsHash, fsResolutions)
		return err
	})
	if err != nil {
		return nil, userError(err)
	}
	if res.Status != statusSuccess {
		return &json.MergeResult{Status: res.Status, Message: res.Message, Address: res.Address}, nil
	}

	// ツリーの修復と取り込みログ（失敗しても取り込み自体は成功とする）
	a.current.FinishMerge(mergeLog)

	return &json.MergeResult{Status: statusSuccess, Address: res.Address}, nil
}

func (a *App) GetModifiedIds() ([]string, error) {

	defer log.PrintTrace(log.Func("GetModifiedIds()"))

	ids, err := a.current.GetModifiedIds()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return ids, nil
}

func (a *App) GetNowPatch(typ string, id string) (*binder.Patch, error) {

	defer log.PrintTrace(log.Func("GetLatestPatch()", typ, id))

	p, err := a.current.GetNowPatch(typ, id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return p, nil
}

func (a *App) RestoreHistory(typ string, id string, hash string) error {

	defer log.PrintTrace(log.Func("RestoreHistory()", typ, id, hash))

	err := a.current.RestoreHistory(typ, id, hash)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}

func (a *App) GetOverallHistory(limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetOverallHistory()"))

	commits, hasMore, err := a.current.GetOverallHistory(limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return toHistoryPage(commits, hasMore), nil
}

func (a *App) GetCommitFiles(hash string) ([]*json.CommitFileEntry, error) {

	defer log.PrintTrace(log.Func("GetCommitFiles()", hash))

	entries, err := a.current.GetCommitFileEntries(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return entries, nil
}

// runClosedBranch は runClosed の結果を BranchResult にする。
func (a *App) runClosedBranch(op func(repo *binder.Repository) error) (*json.BranchResult, error) {
	res, err := a.runClosed(op)
	if err != nil {
		return nil, userError(err)
	}
	return &json.BranchResult{Status: res.Status, Message: res.Message, Address: res.Address}, nil
}

func (a *App) RestoreToCommit(hash string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("RestoreToCommit()", hash))

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	return a.runClosedBranch(func(repo *binder.Repository) error {
		return repo.RestoreToCommit(hash)
	})
}

// --- ByPath 系: バインダー未オープン状態でディレクトリパスから直接操作する ---
// a.current が同じディレクトリを開いていたら、開いているバインダー向けの操作と同じ流れにする。

// GetOverallHistoryByPath はバインダーを開かずにディレクトリパスから全体履歴を取得する。
func (a *App) GetOverallHistoryByPath(dir string, limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetOverallHistoryByPath()", dir))

	commits, hasMore, err := binder.OverallHistoryByPath(dir, limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return toHistoryPage(commits, hasMore), nil
}

// GetCommitFilesByPath はバインダーを開かずにディレクトリパスからコミットのファイル一覧を取得する。
func (a *App) GetCommitFilesByPath(dir string, hash string) ([]*json.CommitFileEntry, error) {

	defer log.PrintTrace(log.Func("GetCommitFilesByPath()", dir, hash))

	entries, err := binder.CommitFileEntriesByPath(dir, hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return entries, nil
}

// RestoreToCommitByPath はバインダーを開かずにディレクトリパスから指定コミットに復元する。
func (a *App) RestoreToCommitByPath(dir string, hash string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("RestoreToCommitByPath()", dir, hash))

	if a.current != nil && a.current.Dir() == dir {
		return a.RestoreToCommit(hash)
	}

	// 書き込む間は「開いている」印を立て、別のプロセスが開いていれば触らない
	repo, err := binder.LockRepository(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	defer repo.Close()

	err = repo.RestoreToCommit(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: statusError, Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: statusSuccess}, nil
}

// ListBranchesByPath はバインダーを開かずにディレクトリパスからブランチ一覧を取得する。
func (a *App) ListBranchesByPath(dir string) ([]string, error) {

	defer log.PrintTrace(log.Func("ListBranchesByPath()", dir))

	if a.current != nil && a.current.Dir() == dir {
		return a.ListBranches()
	}

	repo, err := binder.OpenRepository(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	branches, err := repo.ListBranches()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return branches, nil
}

// CurrentBranchByPath はバインダーを開かずにディレクトリパスから現在のブランチ名を取得する。
func (a *App) CurrentBranchByPath(dir string) (string, error) {

	defer log.PrintTrace(log.Func("CurrentBranchByPath()", dir))

	if a.current != nil && a.current.Dir() == dir {
		return a.CurrentBranch()
	}

	repo, err := binder.OpenRepository(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	name, err := repo.CurrentBranch()
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return name, nil
}

// SwitchBranchByPath はバインダーを開かずにディレクトリパスから指定ブランチに切り替える。
// ワークツリーに未コミット変更がある場合（移行処理失敗後など）は
// git reset --hard HEAD でリセットしてからチェックアウトする。
func (a *App) SwitchBranchByPath(dir string, name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("SwitchBranchByPath()", dir, name))

	if a.current != nil && a.current.Dir() == dir {
		return a.SwitchBranch(name)
	}

	// 書き込む間は「開いている」印を立て、別のプロセスが開いていれば触らない
	repo, err := binder.LockRepository(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	defer repo.Close()

	// 汚れたまま切り替えると、変更が切替先のブランチに持ち込まれる
	if err = repo.DiscardChanges(); err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	err = repo.SwitchBranch(name)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: statusError, Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: statusSuccess}, nil
}

// toHistoryPage は CommitInfo スライスを HistoryPage JSON に変換する。
func toHistoryPage(commits []*fs.CommitInfo, hasMore bool) *json.HistoryPage {
	entries := make([]*json.HistoryEntry, len(commits))
	for i, c := range commits {
		entries[i] = &json.HistoryEntry{
			Hash:    c.Hash,
			Message: c.Message,
			When:    c.When.Format("2006-01-02T15:04:05Z07:00"),
		}
	}
	return &json.HistoryPage{Entries: entries, HasMore: hasMore}
}

func (a *App) GetHistory(typ string, id string, limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetHistory()", typ, id))

	commits, hasMore, err := a.current.GetHistory(typ, id, limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	entries := make([]*json.HistoryEntry, len(commits))
	for i, c := range commits {
		entries[i] = &json.HistoryEntry{
			Hash:    c.Hash,
			Message: c.Message,
			When:    c.When.Format("2006-01-02T15:04:05Z07:00"),
		}
	}
	return &json.HistoryPage{Entries: entries, HasMore: hasMore}, nil
}

func (a *App) GetHistoryPatch(typ string, id string, hash string) (*binder.Patch, error) {

	defer log.PrintTrace(log.Func("GetHistoryPatch()", typ, id, hash))

	p, err := a.current.GetHistoryPatch(typ, id, hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return p, nil
}

func (a *App) ListBranches() ([]string, error) {

	defer log.PrintTrace(log.Func("ListBranches()"))

	branches, err := a.current.ListBranches()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return branches, nil
}

func (a *App) SwitchBranch(name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("SwitchBranch()", name))

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	return a.runClosedBranch(func(repo *binder.Repository) error {
		return repo.SwitchBranch(name)
	})
}

func (a *App) CreateBranch(name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("CreateBranch()", name))

	return a.runClosedBranch(func(repo *binder.Repository) error {
		return repo.CreateBranch(name)
	})
}

// GetCleanupInfo は指定日時でのクリーンアップ統計情報を返す。
func (a *App) GetCleanupInfo(beforeRFC3339 string) (*json.CleanupInfo, error) {

	defer log.PrintTrace(log.Func("GetCleanupInfo()", beforeRFC3339))

	before, err := time.Parse(time.RFC3339, beforeRFC3339)
	if err != nil {
		return nil, userError(err)
	}

	info, err := a.current.GetCleanupInfo(before)
	if err != nil {
		return nil, userError(err)
	}

	return &json.CleanupInfo{
		TotalCommits: info.TotalCommits,
		OldestCommit: info.OldestCommit.Format(time.RFC3339),
		NewestCommit: info.NewestCommit.Format(time.RFC3339),
		BranchName:   info.BranchName,
		SquashTarget: info.SquashTarget,
		KeepTarget:   info.KeepTarget,
		ObjectsSize:  info.ObjectsSize,
	}, nil
}

// SquashHistory は指定日時より古い履歴を圧縮する。
func (a *App) SquashHistory(beforeRFC3339 string) (*json.CleanupResult, error) {

	defer log.PrintTrace(log.Func("SquashHistory()", beforeRFC3339))

	before, err := time.Parse(time.RFC3339, beforeRFC3339)
	if err != nil {
		return nil, userError(err)
	}

	if err := a.requireRecorded(); err != nil {
		return nil, err
	}

	var result *fs.SquashResult
	res, err := a.runClosed(func(repo *binder.Repository) (err error) {
		result, err = repo.SquashHistory(before)
		return err
	})
	if err != nil {
		return nil, userError(err)
	}
	if res.Status != statusSuccess {
		return &json.CleanupResult{Status: res.Status, Message: res.Message, Address: res.Address}, nil
	}

	return &json.CleanupResult{
		Status:     statusSuccess,
		Address:    res.Address,
		BeforeSize: result.BeforeSize,
		AfterSize:  result.AfterSize,
	}, nil
}

// RunGC は不要なgitオブジェクトを削除し、前後のサイズを返す。
// RepackObjects がpackファイルを再作成するため、go-git の内部キャッシュが
// 古いpackを参照し続ける問題を回避するため close→GC→reload パターンを使用。
func (a *App) RunGC() (*json.GCResult, error) {

	defer log.PrintTrace(log.Func("RunGC()"))

	var result *fs.GCResult
	res, err := a.runClosed(func(repo *binder.Repository) error {
		result = repo.GC()
		return nil
	})
	if err != nil {
		return nil, userError(err)
	}
	// ほかの操作と違い、失敗は Status ではなくエラーで返す（画面側がそう受けている）
	if res.opErr != nil {
		return nil, userError(res.opErr)
	}
	if res.reloadErr != nil {
		return nil, userError(res.reloadErr)
	}

	return &json.GCResult{
		BeforeSize: result.BeforeSize,
		AfterSize:  result.AfterSize,
	}, nil
}

func (a *App) RenameBranch(oldName, newName string) error {

	defer log.PrintTrace(log.Func("RenameBranch()", oldName, newName))

	err := a.current.RenameBranch(oldName, newName)
	if err != nil {
		log.PrintStackTrace(err)
		return userError(err)
	}
	return nil
}
