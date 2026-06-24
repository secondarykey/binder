package api

import (
	. "binder/internal"

	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/log"
	"binder/setup/convert"

	"errors"
	"time"

	gogitplumbing "github.com/go-git/go-git/v5/plumbing"
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
			return userError(err)
		}
		return fs.UpdatedFilesError
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
		if !errors.Is(err, fs.UpdatedFilesError) {
			return userError(err)
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
		return nil, userError(err)
	}
	return branches, nil
}

func (a *App) MergeFromRemote(remoteName, remoteBranch string, info *json.UserInfo, save bool) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("MergeFromRemote()", remoteName, remoteBranch))

	// 1. 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
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
		return nil, userError(err)
	}

	// 5. ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	// 6. リポジトリを直接開く
	tmpFs, err := fs.Load(dir)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	// 7. バージョンチェックと移行処理
	sourceHash, err := tmpFs.RemoteBranchHash(remoteName, remoteBranch)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	effectiveHash, versionNewer, err := a.checkMergeSourceVersion(dir, tmpFs, sourceHash)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}
	if versionNewer {
		address, _ := a.LoadBinder(dir)
		return &json.MergeResult{Status: "version_error", Address: address}, nil
	}

	logSetter := func(ml *fs.MergeLog) {
		ml.RemoteName = remoteName
		ml.RemoteBranch = remoteBranch
		if branch, err := a.current.GetCurrentBranch(); err == nil {
			ml.LocalBranch = branch
		}
	}

	// 8a. 移行不要: FF マージを試み、diverged ならコンフリクト検出
	if effectiveHash == sourceHash {
		status, err := tmpFs.MergeFFOnly(remoteName, remoteBranch)
		if err != nil {
			address, reloadErr := a.LoadBinder(dir)
			if reloadErr != nil {
				return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
			}
			return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
		}

		if status == "diverged" {
			analysis, err := tmpFs.DetectConflicts(remoteName, remoteBranch)
			if err != nil {
				address, reloadErr := a.LoadBinder(dir)
				if reloadErr != nil {
					return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
				}
				return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
			}
			return a.handleMergeAnalysis(dir, tmpFs, analysis, logSetter)
		}

		address, err := a.LoadBinder(dir)
		if err != nil {
			return &json.MergeResult{Status: "reload_error", Message: err.Error()}, nil
		}
		return &json.MergeResult{Status: status, Address: address}, nil
	}

	// 8b. 移行あり: ハッシュ直接指定でコンフリクト検出
	currentHash, err := tmpFs.HeadHash()
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	analysis, err := tmpFs.DetectConflictsByHash(currentHash.String(), effectiveHash.String())
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	return a.handleMergeAnalysis(dir, tmpFs, analysis, logSetter)
}

func (a *App) ApplyMergeResolution(resolution *json.MergeResolution) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("ApplyMergeResolution()"))

	// 1. 未コミットチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
	}

	// 2. Binder を閉じる
	dir := a.current.Dir()
	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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

	// 6.5 structure 行が失われた orphan 実体ファイルをツリーへ復元する
	restored, rerr := a.current.ReconcileMergedTree()
	if rerr != nil {
		log.Warn("ReconcileMergedTree() error:\n%+v", rerr)
	}

	// 7. マージログノートを作成（失敗してもマージ自体は成功とする）
	if mergeLog != nil {
		mergeLog.RemoteName = resolution.RemoteName
		mergeLog.RemoteBranch = resolution.RemoteBranch
		mergeLog.SourceBranch = resolution.SourceBranch
		mergeLog.Restored = restored
		if branch, err := a.current.GetCurrentBranch(); err == nil {
			mergeLog.LocalBranch = branch
		}
		if err := a.current.CreateMergeLogNote(mergeLog); err != nil {
			log.Warn("CreateMergeLogNote() error:\n+%v", err)
		}
	}

	return &json.MergeResult{Status: "success", Address: address}, nil
}

// migrateSourceInPlace はデタッチドHEADでソースをチェックアウトし、
// convert.Run() で移行処理を実行して移行後のコミットハッシュを返す。
// 処理後は元のブランチに戻す。移行コミットはリポジトリのオブジェクトストアに残り、
// ハッシュ経由でアクセス可能。
func migrateSourceInPlace(dir string, tmpFs *fs.FileSystem, sourceHash gogitplumbing.Hash, appVer *Version) (gogitplumbing.Hash, error) {
	currentBranch, err := tmpFs.CurrentBranch()
	if err != nil {
		return gogitplumbing.ZeroHash, xerrors.Errorf("CurrentBranch() error: %w", err)
	}

	// 元のHEADハッシュを保存しておく（CheckoutBranch失敗時の強制復元用）
	currentHash, err := tmpFs.HeadHash()
	if err != nil {
		return gogitplumbing.ZeroHash, xerrors.Errorf("HeadHash() error: %w", err)
	}

	if err := tmpFs.CheckoutDetached(sourceHash); err != nil {
		return gogitplumbing.ZeroHash, xerrors.Errorf("CheckoutDetached() error: %w", err)
	}

	// エラー時も必ず元のブランチに戻す。
	// CheckoutBranch が失敗した場合は currentHash で強制チェックアウトし、
	// ワークツリーが不整合な状態で残らないようにする。
	defer func() {
		if restoreErr := tmpFs.CheckoutBranch(currentBranch); restoreErr != nil {
			log.Warn("migrateSourceInPlace: CheckoutBranch() error, forcing checkout to current hash:\n%+v", restoreErr)
			if forceErr := tmpFs.CheckoutDetached(currentHash); forceErr != nil {
				log.Warn("migrateSourceInPlace: force CheckoutDetached() also failed:\n%+v", forceErr)
			}
		}
	}()

	if _, err := convert.Run(dir, appVer); err != nil {
		return gogitplumbing.ZeroHash, xerrors.Errorf("convert.Run() error: %w", err)
	}

	migratedHash, err := tmpFs.HeadHash()
	if err != nil {
		return gogitplumbing.ZeroHash, xerrors.Errorf("HeadHash() error: %w", err)
	}

	return migratedHash, nil
}

// checkMergeSourceVersion はマージ元のバージョンを確認し、必要なら移行処理を実行する。
// 戻り値:
//   - resultHash: 使用すべきハッシュ（移行後はmigratedHash、不要ならsourceHashのまま）
//   - versionNewer: マージ元がアプリより新しい場合 true（バージョンアップを促す）
func (a *App) checkMergeSourceVersion(dir string, tmpFs *fs.FileSystem, sourceHash gogitplumbing.Hash) (resultHash gogitplumbing.Hash, versionNewer bool, err error) {
	meta, err := tmpFs.ReadMetaFromHash(sourceHash)
	if err != nil {
		return sourceHash, false, xerrors.Errorf("ReadMetaFromHash() error: %w", err)
	}

	sourceVer, verErr := NewVersion(meta.Version)
	if verErr != nil {
		// パースできない場合は古いバインダーとして扱う
		sourceVer, _ = NewVersion("0.0.0")
	}

	// マージ元がアプリより新しい場合はバージョンアップが必要
	if sourceVer.Gt(a.version) {
		return sourceHash, true, nil
	}

	// 移行が不要な場合はそのまま返す
	if !convert.NeedsMigration(sourceVer) {
		return sourceHash, false, nil
	}

	// 移行が必要: インプレースで実行してハッシュを返す
	migratedHash, err := migrateSourceInPlace(dir, tmpFs, sourceHash, a.version)
	if err != nil {
		return sourceHash, false, xerrors.Errorf("migrateSourceInPlace() error: %w", err)
	}

	return migratedHash, false, nil
}

// MergeFromLocal はローカルブランチを現在のブランチにマージする。
// handleMergeAnalysis はコンフリクト分析結果を処理し、自動解決またはユーザー選択待ちの結果を返す。
func (a *App) handleMergeAnalysis(dir string, tmpFs *fs.FileSystem, analysis *fs.MergeAnalysis, logSetter func(*fs.MergeLog)) (*json.MergeResult, error) {
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
		// structure 行が失われた orphan 実体ファイルをツリーへ復元する
		restored, rerr := a.current.ReconcileMergedTree()
		if rerr != nil {
			log.Warn("ReconcileMergedTree() error:\n%+v", rerr)
		}
		if mergeLog != nil {
			logSetter(mergeLog)
			mergeLog.Restored = restored
			if err := a.current.CreateMergeLogNote(mergeLog); err != nil {
				log.Warn("CreateMergeLogNote() error:\n%+v", err)
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

// MergeFromLocal はローカルブランチを現在のブランチにマージする。
func (a *App) MergeFromLocal(sourceBranch string) (*json.MergeResult, error) {

	defer log.PrintTrace(log.Func("MergeFromLocal()", sourceBranch))

	// 1. 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
	}

	// 2. ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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

	// 4. バージョンチェックと移行処理
	sourceHash, err := tmpFs.LocalBranchHash(sourceBranch)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	effectiveHash, versionNewer, err := a.checkMergeSourceVersion(dir, tmpFs, sourceHash)
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}
	if versionNewer {
		address, _ := a.LoadBinder(dir)
		return &json.MergeResult{Status: "version_error", Address: address}, nil
	}

	logSetter := func(ml *fs.MergeLog) {
		ml.SourceBranch = sourceBranch
		if branch, err := a.current.GetCurrentBranch(); err == nil {
			ml.LocalBranch = branch
		}
	}

	// 5a. 移行不要: FF マージを試み、diverged ならコンフリクト検出
	if effectiveHash == sourceHash {
		status, err := tmpFs.MergeFFOnlyLocal(sourceBranch)
		if err != nil {
			address, reloadErr := a.LoadBinder(dir)
			if reloadErr != nil {
				return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
			}
			return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
		}

		if status == "diverged" {
			analysis, err := tmpFs.DetectConflictsFromLocalBranch(sourceBranch)
			if err != nil {
				address, reloadErr := a.LoadBinder(dir)
				if reloadErr != nil {
					return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
				}
				return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
			}
			return a.handleMergeAnalysis(dir, tmpFs, analysis, logSetter)
		}

		address, err := a.LoadBinder(dir)
		if err != nil {
			return &json.MergeResult{Status: "reload_error", Message: err.Error()}, nil
		}
		return &json.MergeResult{Status: status, Address: address}, nil
	}

	// 5b. 移行あり: ハッシュ直接指定でコンフリクト検出
	currentHash, err := tmpFs.HeadHash()
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	analysis, err := tmpFs.DetectConflictsByHash(currentHash.String(), effectiveHash.String())
	if err != nil {
		address, reloadErr := a.LoadBinder(dir)
		if reloadErr != nil {
			return &json.MergeResult{Status: "reload_error", Message: reloadErr.Error()}, nil
		}
		return &json.MergeResult{Status: "error", Message: err.Error(), Address: address}, nil
	}

	return a.handleMergeAnalysis(dir, tmpFs, analysis, logSetter)
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

	files, err := a.current.GetCommitFiles(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return toCommitFileEntries(files, a.current), nil
}

func (a *App) RestoreToCommit(hash string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("RestoreToCommit()", hash))

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
	}

	// ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
			return nil, userError(err)
		}
		return toHistoryPage(commits, hasMore), nil
	}

	// binder.Load() 失敗 → fs.Load() にフォールバック
	log.Warn("binder.Load() failed, falling back to fs.Load():\n%+v", err)
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	commits, hasMore, err := tmpFs.GetOverallHistory(limit, offset)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
			return nil, userError(err)
		}
		return toCommitFileEntries(files, b), nil
	}

	// binder.Load() 失敗 → fs.Load() にフォールバック（名前解決なし）
	log.Warn("binder.Load() failed, falling back to fs.Load():\n%+v", err)
	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	files, err := tmpFs.GetCommitFiles(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
		return nil, userError(err)
	}

	err = tmpFs.RestoreToCommit(hash)
	if err != nil {
		log.PrintStackTrace(err)
		return &json.BranchResult{Status: "error", Message: err.Error()}, nil
	}

	return &json.BranchResult{Status: "success"}, nil
}

// ListBranchesByPath はバインダーを開かずにディレクトリパスからブランチ一覧を取得する。
func (a *App) ListBranchesByPath(dir string) ([]string, error) {

	defer log.PrintTrace(log.Func("ListBranchesByPath()", dir))

	if a.current != nil && a.current.Dir() == dir {
		return a.ListBranches()
	}

	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	branches, err := tmpFs.ListBranches()
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

	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	name, err := tmpFs.CurrentBranch()
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}
	return name, nil
}

// SwitchBranchByPath はバインダーを開かずにディレクトリパスから指定ブランチに切り替える。
// もし a.current が同じディレクトリを開いていたら SwitchBranch と同じフローにする。
// ワークツリーに未コミット変更がある場合（移行処理失敗後など）は
// git reset --hard HEAD でリセットしてからチェックアウトする。
func (a *App) SwitchBranchByPath(dir string, name string) (*json.BranchResult, error) {

	defer log.PrintTrace(log.Func("SwitchBranchByPath()", dir, name))

	if a.current != nil && a.current.Dir() == dir {
		return a.SwitchBranch(name)
	}

	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	// 未コミット変更がある場合（移行失敗後など）はリセットしてからチェックアウトする。
	// ワークツリーがクリーンでない状態のままブランチ切替すると、
	// dirty な変更が切替先ブランチに持ち込まれるのを防ぐ。
	if err = tmpFs.ResetHard(); err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	err = tmpFs.CheckoutBranch(name)
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

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
	}

	// ディレクトリを保存してから Binder を閉じる
	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
		return nil, userError(err)
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
// RestoreToCommit と同じ close→操作→reload パターンを使用。
func (a *App) SquashHistory(beforeRFC3339 string) (*json.CleanupResult, error) {

	defer log.PrintTrace(log.Func("SquashHistory()", beforeRFC3339))

	before, err := time.Parse(time.RFC3339, beforeRFC3339)
	if err != nil {
		return nil, userError(err)
	}

	// 未コミット変更のチェック
	ids, err := a.current.GetModifiedIds()
	if err != nil {
		return nil, userError(err)
	}
	if len(ids) > 0 {
		return nil, userError(ErrUncommittedChanges)
	}

	dir := a.current.Dir()

	err = a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
// RepackObjects がpackファイルを再作成するため、go-git の内部キャッシュが
// 古いpackを参照し続ける問題を回避するため close→GC→reload パターンを使用。
func (a *App) RunGC() (*json.GCResult, error) {

	defer log.PrintTrace(log.Func("RunGC()"))

	dir := a.current.Dir()

	err := a.CloseBinder()
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}

	tmpFs, err := fs.Load(dir)
	if err != nil {
		log.PrintStackTrace(err)
		a.LoadBinder(dir)
		return nil, userError(err)
	}

	result := tmpFs.GC()

	_, err = a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
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
