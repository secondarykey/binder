package api

import (
	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/log"

	"errors"
	"fmt"
	"time"

	"golang.org/x/xerrors"
)

func (a *App) CommitFiles(leafs []*json.Leaf, m string) error {

	files := make([]string, len(leafs))
	for idx, leaf := range leafs {
		f := a.current.ToFile(leaf.Type, leaf.Id)
		files[idx] = f
	}
	err := a.current.CommitFiles(m, files...)
	if err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return xerrors.Errorf("Commit() error: %+v", err)
		}
		return fs.UpdatedFilesError
	}
	return nil
}

func (a *App) Commit(mode string, id string, m string) error {

	defer log.PrintTrace(log.Func("Commit()", id, mode))

	f := a.current.ToFile(mode, id)
	err := a.current.CommitFiles(m, f)
	if err != nil {
		if !errors.Is(err, fs.UpdatedFilesError) {
			return xerrors.Errorf("Commit() error: %+v", err)
		}
		return fs.UpdatedFilesError
	}
	return nil
}

func (a *App) Remotes() ([]string, error) {

	defer log.PrintTrace(log.Func("Remotes()"))

	remotes, err := a.current.GetRemotes()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetRemotes() error: %+v", err)
	}
	return remotes, nil
}

func (a *App) AddRemote(name string, url string) error {

	defer log.PrintTrace(log.Func("AddRemote()"))

	err := a.current.CreateRemote(name, url)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("CreateRemote() error: %+v", err)
	}
	return nil
}

func (a *App) CurrentBranch() (string, error) {

	defer log.PrintTrace(log.Func("CurrentBranch()"))

	name, err := a.current.GetCurrentBranch()
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("GetCurrentBranch() error: %+v", err)
	}
	return name, nil
}

func (a *App) RemoteList() ([]*json.Remote, error) {

	defer log.PrintTrace(log.Func("RemoteList()"))

	remotes, err := a.current.GetRemoteList()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetRemoteList() error: %+v", err)
	}
	return remotes, nil
}

func (a *App) EditRemote(name string, url string) error {

	defer log.PrintTrace(log.Func("EditRemote()"))

	err := a.current.EditRemote(name, url)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("EditRemote() error: %+v", err)
	}
	return nil
}

func (a *App) DeleteRemote(name string) error {

	defer log.PrintTrace(log.Func("DeleteRemote()"))

	err := a.current.DeleteRemote(name)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("DeleteRemote() error: %+v", err)
	}
	return nil
}

func (a *App) Push(remoteName string, info *json.UserInfo, save bool) error {

	defer log.PrintTrace(log.Func("Push()"))

	err := a.current.Push(remoteName, info, save)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("Push() error: %+v", err)
	}
	return nil
}

func (a *App) ListRemoteBranches(url string, info *json.UserInfo) ([]string, error) {

	defer log.PrintTrace(log.Func("ListRemoteBranches()"))

	var fsInfo *fs.UserInfo
	if info != nil {
		fsInfo = &fs.UserInfo{
			AuthType:   fs.AuthType(info.AuthType),
			Username:   info.Username,
			Password:   info.Password,
			Token:      info.Token,
			Passphrase: info.Passphrase,
			Filename:   info.Filename,
			Bytes:      info.Bytes,
		}
	}

	branches, err := fs.ListRemoteBranches(url, fsInfo)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("ListRemoteBranches() error\n%+v", err)
	}
	return branches, nil
}

func (a *App) MergeFromRemote(remoteName, remoteBranch string, info *json.UserInfo, save bool) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("MergeFromRemote()", remoteName, remoteBranch))

	// 1. 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	if len(ids) > 0 {
		return nil, fmt.Errorf("uncommitted changes exist")
	}

	// 2. 認証情報を変換
	fsInfo := &fs.UserInfo{
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

	// 3. 認証情報の保存（オプション）
	if save {
		a.current.SaveUserInfo(fsInfo)
	}

	// 4. Fetch（Binder を閉じる前に実行 — Fetch はDB操作を伴わない）
	err = a.current.Fetch(remoteName, remoteBranch, fsInfo)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("Fetch() error: %+v", err)
	}

	// 5. ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	// 6. リポジトリを直接開いて fast-forward マージ
	tmpFs, err := fs.Load(dir)
	if err != nil {
		// マージできなくても Binder を再オープン
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	status, err := tmpFs.MergeFFOnly(remoteName, remoteBranch)
	if err != nil {
		// エラー時も Binder を再オープン
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// 7. diverged の場合はコンフリクト検出
	if status == "diverged" {
		analysis, err := tmpFs.DetectConflicts(remoteName, remoteBranch)
		if err != nil {
			address, reloadErr := a.LoadBinder(dir)
			if reloadErr != nil {
				return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
			}
			return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
		}

		if len(analysis.Conflicts) == 0 {
			// 全て自動解決可能 → 即マージ
			mergeLog, err := tmpFs.ApplyResolutions(analysis, nil)
			if err != nil {
				address, reloadErr := a.LoadBinder(dir)
				if reloadErr != nil {
					return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
				}
				return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
			}
			address, err := a.LoadBinder(dir)
			if err != nil {
				return &json.MergeResult{Status: "reload_error", Message: err.Error()}, nil
			}

			// マージログノートを作成（失敗してもマージ自体は成功とする）
			if mergeLog != nil {
				mergeLog.RemoteName = remoteName
				mergeLog.RemoteBranch = remoteBranch
				if branch, err := a.current.GetCurrentBranch(); err == nil {
					mergeLog.LocalBranch = branch
				}
				if err := a.current.CreateMergeLogNote(mergeLog); err != nil {
					log.WarnE("CreateMergeLogNote() error", err)
				}
			}

			return &json.MergeResult{
				Status:       "success",
				Address:      address,
				AutoResolved: len(analysis.AutoFiles),
			}, nil
		}

		// コンフリクトあり → Binder を再オープンしてユーザー選択を待つ
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}

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
			Status:       "conflicts",
			Address:      address,
			Conflicts:    conflicts,
			BaseHash:     analysis.BaseHash.String(),
			OursHash:     analysis.OursHash.String(),
			TheirsHash:   analysis.TheirsHash.String(),
			AutoResolved: len(analysis.AutoFiles),
		}, nil
	}

	// 8. Binder を再オープン
	address, err := a.LoadBinder(dir)
	if err != nil {
		return &json.MergeResult{Status: "reload_error", Message: err.Error()}, nil
	}

	return &json.MergeResult{Status: status, Address: address}, nil
}

func (a *App) ApplyMergeResolution(resolution *json.MergeResolution) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("ApplyMergeResolution()"))

	// 1. 未コミットチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	if len(ids) > 0 {
		return nil, fmt.Errorf("uncommitted changes exist")
	}

	// 2. Binder を閉じる
	dir := a.current.Dir()
	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	// 3. リポジトリを直接開く
	tmpFs, err := fs.Load(dir)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// 4. 再度コンフリクト検出（ハッシュの整合性を検証）
	// remoteName/branchName はハッシュから逆引きできないので、
	// ハッシュを直接使って MergeAnalysis を再構築する
	analysis, err := tmpFs.DetectConflictsByHash(
		resolution.OursHash, resolution.TheirsHash)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// 5. ユーザー選択を fs.FileResolution に変換して適用
	fsResolutions := make([]fs.FileResolution, len(resolution.Resolutions))
	for i, r := range resolution.Resolutions {
		fsResolutions[i] = fs.FileResolution{
			Path:       r.Path,
			Resolution: r.Resolution,
		}
	}

	mergeLog, err := tmpFs.ApplyResolutions(analysis, fsResolutions)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// 6. Binder を再オープン
	address, err := a.LoadBinder(dir)
	if err != nil {
		return &json.MergeResult{Status: "reload_error", Message: err.Error()}, nil
	}

	// 7. マージログノートを作成（失敗してもマージ自体は成功とする）
	if mergeLog != nil {
		mergeLog.RemoteName = resolution.RemoteName
		mergeLog.RemoteBranch = resolution.RemoteBranch
		if branch, err := a.current.GetCurrentBranch(); err == nil {
			mergeLog.LocalBranch = branch
		}
		if err := a.current.CreateMergeLogNote(mergeLog); err != nil {
			log.WarnE("CreateMergeLogNote() error", err)
		}
	}

	return &json.MergeResult{Status: "success", Address: address}, nil
}

func (a *App) GetModifiedIds() ([]string, error) {

	defer log.PrintTrace(log.Func("GetModifiedIds()"))

	ids, err := a.current.GetModifiedIds()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	return ids, nil
}

func (a *App) GetNowPatch(typ string, id string) (*binder.Patch, error) {

	defer log.PrintTrace(log.Func("GetLatestPatch()", typ, id))

	p, err := a.current.GetNowPatch(typ, id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetLatestPath() error: %+v", err)
	}
	return p, nil
}

func (a *App) RestoreHistory(typ string, id string, hash string) error {

	defer log.PrintTrace(log.Func("RestoreHistory()", typ, id, hash))

	err := a.current.RestoreHistory(typ, id, hash)
	if err != nil {
		log.PrintStackTrace(err)
		return fmt.Errorf("RestoreHistory() error: %+v", err)
	}
	return nil
}

func (a *App) GetOverallHistory(limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetOverallHistory()"))

	commits, hasMore, err := a.current.GetOverallHistory(limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetOverallHistory() error: %+v", err)
	}
	return toHistoryPage(commits, hasMore), nil
}

func (a *App) GetCommitFiles(hash string) ([]*json.CommitFileEntry, error) {

	defer log.PrintTrace(log.Func("GetCommitFiles()", hash))

	files, err := a.current.GetCommitFiles(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetCommitFiles() error: %+v", err)
	}
	return toCommitFileEntries(files, a.current), nil
}

func (a *App) RestoreToCommit(hash string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("RestoreToCommit()", hash))

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	if len(ids) > 0 {
		return nil, fmt.Errorf("uncommitted changes exist")
	}

	// ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	// リポジトリを直接開いて復元
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	err = tmpFs.RestoreToCommit(hash)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// Binder を再読み込み
	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: "reload_error", Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: "success", Address: address}, nil
}

// --- ByPath 系: バインダー未オープン状態でディレクトリパスから直接操作する ---

// GetOverallHistoryByPath はバインダーを開かずにディレクトリパスから全体履歴を取得する。
// binder.Load() を試み、失敗したら fs.Load() にフォールバックする。
func (a *App) GetOverallHistoryByPath(dir string, limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetOverallHistoryByPath()", dir))

	// まず binder.Load() を試みる
	b, err := binder.Load(dir)
	if err == nil {
		defer b.Close()
		commits, hasMore, err := b.GetOverallHistory(limit, offset)
		if err != nil {
			log.PrintStackTrace(err)
			return nil, fmt.Errorf("GetOverallHistory() error: %+v", err)
		}
		return toHistoryPage(commits, hasMore), nil
	}

	// binder.Load() 失敗 → fs.Load() にフォールバック
	log.WarnE("binder.Load() failed, falling back to fs.Load()", err)
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("fs.Load() error: %+v", err)
	}
	commits, hasMore, err := tmpFs.GetOverallHistory(limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetOverallHistory() error: %+v", err)
	}
	return toHistoryPage(commits, hasMore), nil
}

// GetCommitFilesByPath はバインダーを開かずにディレクトリパスからコミットのファイル一覧を取得する。
func (a *App) GetCommitFilesByPath(dir string, hash string) ([]*json.CommitFileEntry, error) {

	defer log.PrintTrace(log.Func("GetCommitFilesByPath()", dir, hash))

	// まず binder.Load() を試みる（名前解決のため）
	b, err := binder.Load(dir)
	if err == nil {
		defer b.Close()
		files, err := b.GetCommitFiles(hash)
		if err != nil {
			log.PrintStackTrace(err)
			return nil, fmt.Errorf("GetCommitFiles() error: %+v", err)
		}
		return toCommitFileEntries(files, b), nil
	}

	// binder.Load() 失敗 → fs.Load() にフォールバック（名前解決なし）
	log.WarnE("binder.Load() failed, falling back to fs.Load()", err)
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("fs.Load() error: %+v", err)
	}
	files, err := tmpFs.GetCommitFiles(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetCommitFiles() error: %+v", err)
	}
	// 名前解決なし: パスをそのまま名前にする
	entries := make([]*json.CommitFileEntry, len(files))
	for i, f := range files {
		entries[i] = &json.CommitFileEntry{
			Typ:    f.Typ,
			Id:     f.Id,
			Action: f.Action,
			Name:   f.Id,
		}
	}
	return entries, nil
}

// RestoreToCommitByPath はバインダーを開かずにディレクトリパスから指定コミットに復元する。
// もし a.current が同じディレクトリを開いていたら Close→Restore→Reload する。
func (a *App) RestoreToCommitByPath(dir string, hash string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("RestoreToCommitByPath()", dir, hash))

	// a.current が同じディレクトリを開いていたら既存の RestoreToCommit と同じフローにする
	if a.current != nil && a.current.Dir() == dir {
		return a.RestoreToCommit(hash)
	}

	// バインダー未オープン: fs.Load で直接復元
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("fs.Load() error: %+v", err)
	}

	err = tmpFs.RestoreToCommit(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: "error", Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: "success"}, nil
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

// toCommitFileEntries は CommitFile スライスを CommitFileEntry JSON に変換する。
// Binder が利用可能なら Structure から名前解決する。
func toCommitFileEntries(files []*fs.CommitFile, b *binder.Binder) []*json.CommitFileEntry {
	entries := make([]*json.CommitFileEntry, len(files))
	for i, f := range files {
		name := f.Id
		if b != nil {
			switch f.Typ {
			case "database", "publish", "other":
				name = f.Id
			case "asset":
				name = f.Id
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

func (a *App) GetHistory(typ string, id string, limit int, offset int) (*json.HistoryPage, error) {

	defer log.PrintTrace(log.Func("GetHistory()", typ, id))

	commits, hasMore, err := a.current.GetHistory(typ, id, limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("GetHistory() error: %+v", err)
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
		return nil, fmt.Errorf("GetHistoryPatch() error: %+v", err)
	}
	return p, nil
}

func (a *App) ListBranches() ([]string, error) {

	defer log.PrintTrace(log.Func("ListBranches()"))

	branches, err := a.current.ListBranches()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("ListBranches() error: %+v", err)
	}
	return branches, nil
}

func (a *App) SwitchBranch(name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("SwitchBranch()", name))

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	if len(ids) > 0 {
		return nil, fmt.Errorf("uncommitted changes exist")
	}

	// ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	// リポジトリを直接開いてチェックアウト
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		// Binder を復旧
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	err = tmpFs.CheckoutBranch(name)
	if err != nil {
		log.PrintStackTrace(err)
		// Binder を復旧
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// Binder を再読み込み
	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: "reload_error", Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: "success", Address: address}, nil
}

func (a *App) CreateBranch(name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("CreateBranch()", name))

	// ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err := a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	// リポジトリを直接開いてブランチ作成+チェックアウト
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	err = tmpFs.Branch(name)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.BranchResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.BranchResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// Binder を再読み込み
	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: "reload_error", Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: "success", Address: address}, nil
}

// GetCleanupInfo は指定日時でのクリーンアップ統計情報を返す。
func (a *App) GetCleanupInfo(beforeRFC3339 string) (*json.CleanupInfo, error) {

	defer log.PrintTrace(log.Func("GetCleanupInfo()", beforeRFC3339))

	before, err := time.Parse(time.RFC3339, beforeRFC3339)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %+v", err)
	}

	info, err := a.current.GetCleanupInfo(before)
	if err != nil {
		return nil, fmt.Errorf("GetCleanupInfo() error: %+v", err)
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
// RestoreToCommit と同じ close→操作→reload パターンを使用。
func (a *App) SquashHistory(beforeRFC3339 string) (*json.CleanupResult, error) {

	defer log.PrintTrace(log.Func("SquashHistory()", beforeRFC3339))

	before, err := time.Parse(time.RFC3339, beforeRFC3339)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %+v", err)
	}

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, fmt.Errorf("GetModifiedIds() error: %+v", err)
	}
	if len(ids) > 0 {
		return nil, fmt.Errorf("uncommitted changes exist")
	}

	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, fmt.Errorf("CloseBinder() error: %+v", err)
	}

	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.CleanupResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.CleanupResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	result, err := tmpFs.SquashHistory(before)
	if err != nil {
		log.PrintStackTrace(err)
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.CleanupResult{Status: "error", Message: err.Error(), Address: address}, nil
		}
		return &json.CleanupResult{Status: "error", Message: err.Error()}, nil
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.CleanupResult{Status: "reload_error", Message: err.Error()}, nil
	}

	return &json.CleanupResult{
		Status:     "success",
		Address:    address,
		BeforeSize: result.BeforeSize,
		AfterSize:  result.AfterSize,
	}, nil
}

// RunGC は不要なgitオブジェクトを削除し、前後のサイズを返す。
func (a *App) RunGC() (*json.GCResult, error) {

	defer log.PrintTrace(log.Func("RunGC()"))

	result := a.current.GC()
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
		return fmt.Errorf("RenameBranch() error: %+v", err)
	}
	return nil
}
