package fs

import (
	"binder/log"
	"binder/settings"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/diff"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
	"github.com/go-git/go-git/v5/storage/memory"
	"golang.org/x/xerrors"
)

var NoUpdated = fmt.Errorf("updates to the file")
var UpdatedFilesError = fmt.Errorf("No updated files")

func M(header string, name string) string {
	return fmt.Sprintf("%s : %s", header, name)
}

type ModifiedFiles []*Modified

func (data ModifiedFiles) Ids() []interface{} {
	ids := make([]interface{}, len(data))
	for idx, m := range data {
		ids[idx] = m.Id
	}
	return ids
}

func (data ModifiedFiles) Exists() bool {
	return len(data) > 0
}

func (data ModifiedFiles) Notes() ModifiedFiles {
	return data.filter("note")
}

func (data ModifiedFiles) Diagrams() ModifiedFiles {
	return data.filter("diagram")
}

func (data ModifiedFiles) Assets() ModifiedFiles {
	return data.filter("asset")
}

func (data ModifiedFiles) Templates() ModifiedFiles {
	return data.filter("template")
}

func (data ModifiedFiles) filter(t string) ModifiedFiles {
	var files []*Modified
	for _, f := range data {
		if t == f.Typ {
			files = append(files, f)
		}
	}
	return files
}

type Modified struct {
	Id     string
	Typ    string
	Status *git.FileStatus
}

// ListRemoteBranches はリモートURLに接続し、ブランチ一覧を返す。
// Binderが存在しない状態でも使用可能。
func ListRemoteBranches(url string, info *UserInfo) ([]string, error) {
	rem := git.NewRemote(memory.NewStorage(), &config.RemoteConfig{
		Name: "origin",
		URLs: []string{url},
	})

	var auth transport.AuthMethod
	if info != nil && info.AuthType != AuthNone {
		var err error
		auth, err = authMethod(info)
		if err != nil {
			return nil, xerrors.Errorf("authMethod() error: %w", err)
		}
	}

	refs, err := rem.List(&git.ListOptions{Auth: auth})
	if err != nil {
		return nil, xerrors.Errorf("remote.List() error: %w", err)
	}

	var branches []string
	for _, ref := range refs {
		if ref.Name().IsBranch() {
			branches = append(branches, ref.Name().Short())
		}
	}
	sort.Strings(branches)
	return branches, nil
}

func (f *FileSystem) CreateRemote(name, url string) error {

	_, err := f.repo.CreateRemote(&config.RemoteConfig{
		Name: name,
		URLs: []string{url},
	})

	if err != nil {
		return xerrors.Errorf("CreateRemote() error: %w", err)
	}

	return nil
}

func (f *FileSystem) EditRemote(name, url string) error {
	err := f.repo.DeleteRemote(name)
	if err != nil {
		return xerrors.Errorf("DeleteRemote(%s) error: %w", name, err)
	}
	_, err = f.repo.CreateRemote(&config.RemoteConfig{
		Name: name,
		URLs: []string{url},
	})
	if err != nil {
		return xerrors.Errorf("CreateRemote(%s) error: %w", name, err)
	}
	return nil
}

func (f *FileSystem) DeleteRemote(name string) error {
	err := f.repo.DeleteRemote(name)
	if err != nil {
		return xerrors.Errorf("DeleteRemote(%s) error: %w", name, err)
	}
	return nil
}

func (f *FileSystem) GetRemotes() ([]*config.RemoteConfig, error) {
	r, err := f.repo.Remotes()
	if err != nil {
		return nil, xerrors.Errorf("repository.Remotes() error: %w", err)
	}

	rtn := make([]*config.RemoteConfig, len(r))
	for idx, remote := range r {
		rtn[idx] = remote.Config()
	}
	return rtn, nil
}

func (f *FileSystem) Push(r, name string, info *UserInfo) error {

	auth, err := authMethod(info)
	if err != nil {
		return xerrors.Errorf("authMethod() error: %w", err)
	}

	remote, err := f.repo.Remote(r)
	if err != nil {
		return xerrors.Errorf("Remote() error: %w", err)
	}

	refSpec := config.RefSpec(
		fmt.Sprintf("+refs/heads/%s:refs/heads/%s", name, name))
	err = remote.Push(&git.PushOptions{
		Progress: os.Stdout,
		RefSpecs: []config.RefSpec{refSpec},
		Auth:     auth,
	})

	if err != nil {
		return xerrors.Errorf("remote Push() error: %w", err)
	}

	return nil
}

// authMethod はUserInfoの認証種別に応じたtransport.AuthMethodを返す。
func authMethod(info *UserInfo) (transport.AuthMethod, error) {
	switch info.AuthType {
	case AuthBasic:
		return &http.BasicAuth{
			Username: info.Username,
			Password: info.Password,
		}, nil
	case AuthToken:
		return &http.TokenAuth{
			Token: info.Token,
		}, nil
	case AuthSSHKey, AuthSSHFile, AuthSSHBytes:
		key, err := ssh.NewPublicKeys("git", info.Bytes, info.Passphrase)
		if err != nil {
			return nil, xerrors.Errorf("ssh.NewPublicKeys() error: %w", err)
		}
		return key, nil
	case AuthSSHAgent:
		key, err := ssh.NewSSHAgentAuth("git")
		if err != nil {
			return nil, xerrors.Errorf("ssh.NewSSHAgentAuth() error: %w", err)
		}
		return key, nil
	default:
		return nil, fmt.Errorf("unknown AuthType: %s", info.AuthType)
	}
}

// CurrentBranch は現在のブランチ名を返す。
func (f *FileSystem) CurrentBranch() (string, error) {
	head, err := f.repo.Head()
	if err != nil {
		return "", xerrors.Errorf("repository Head() error: %w", err)
	}
	return head.Name().Short(), nil
}

func (f *FileSystem) Branch(name string) error {

	head, err := f.repo.Head()
	if err != nil {
		return xerrors.Errorf("repository Head() error: %w", err)
	}

	branch := plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", name))
	refName := head.Name()
	if string(branch) == string(refName) {
		return nil
	}

	ref := plumbing.NewHashReference(branch, head.Hash())
	err = f.repo.Storer.SetReference(ref)
	if err != nil {
		return xerrors.Errorf("repository SetReference() error: %w", err)
	}

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	//TODO すでに存在して処理する場合

	err = w.Checkout(&git.CheckoutOptions{Branch: branch})
	if err != nil {
		return xerrors.Errorf("Checkout() error: %w", err)
	}
	return nil
}

// SetUserSig はバインダーごとのユーザ署名を設定する。
func (f *FileSystem) SetUserSig(info *UserInfo) {
	f.userSig = info
}

// userSigOrDefault はバインダーのユーザ署名があればそれを、なければアプリ設定を使用する。
func (f *FileSystem) userSigOrDefault() *object.Signature {
	if f.userSig != nil && f.userSig.Name != "" {
		return &object.Signature{
			Name:  f.userSig.Name,
			Email: f.userSig.Email,
			When:  time.Now(),
		}
	}
	return UserSig()
}

func UserSig() *object.Signature {
	set := settings.Get()
	auth := set.Git
	sig := &object.Signature{
		Name:  auth.Name,
		Email: auth.Mail,
		When:  time.Now(),
	}
	return sig
}

func SystemSig() *object.Signature {
	sig := &object.Signature{
		Name:  "Binder System",
		Email: "binder@localhost",
		When:  time.Now(),
	}
	return sig
}

// ファイルをコミットする
func (f *FileSystem) Commit(m string, files ...string) error {
	return f.commit(m, f.userSigOrDefault(), false, files...)
}

func (f *FileSystem) AutoCommit(m string, files ...string) error {
	return f.autoCommit(m, false, files...)
}

// 自動コミット
func (f *FileSystem) autoCommit(m string, all bool, files ...string) error {
	return f.commit(m, SystemSig(), all, files...)
}

func (f *FileSystem) CommitAll(m string) error {
	return f.autoCommit(m, true)
}

func (f *FileSystem) modified(files ...string) ([]string, error) {

	w, err := f.repo.Worktree()
	if err != nil {
		return nil, xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return nil, xerrors.Errorf("Status() error: %w", err)
	}

	names := make([]string, 0, len(files))
	gp := convertPaths(files...)

	for idx, f := range gp {
		_, ok := status[f]
		if ok {
			//存在する為、変更あり
			//if s.Worktree == git.Modified {
			//}
			names = append(names, files[idx])
		}
	}

	if len(names) == 0 {
		//更新がない場合
		//log.Info("names is zero")
	}
	return names, nil
}

func (f *FileSystem) Status() (ModifiedFiles, error) {

	w, err := f.repo.Worktree()
	if err != nil {
		return nil, xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return nil, xerrors.Errorf("Status() error: %w", err)
	}

	var rtn []*Modified
	//notes,diagrams,templates 以外ないはず
	for f, s := range status {

		//TODO なんかログを考える
		//log.Debug("Status", "File", f, "Staging", s.Staging, "Worktree", s.Worktree, "Extra", s.Extra)

		//fmt.Printf("%60s | %c %c %s\n", f, s.Staging, s.Worktree, s.Extra)
		mod, err := getModelType(f)
		if err != nil {
			// db/・binder.json など管理外のファイルは無視（Debugレベル）
			log.DebugE("getModelType() error", err)
		} else {
			mod.Status = s
			rtn = append(rtn, mod)
		}
	}

	return rtn, nil
}

func getModelType(f string) (*Modified, error) {

	var mod Modified

	data := strings.Split(f, "/")
	if len(data) < 2 {
		return nil, fmt.Errorf("Path error")
	}

	fn := data[1]
	if strings.Index(f, NoteDir) == 0 {
		mod.Typ = "note"
		//".md"
		mod.Id = fn[:len(fn)-3]
	} else if strings.Index(f, DiagramDir) == 0 {
		mod.Typ = "diagram"
		//".md"
		mod.Id = fn[:len(fn)-3]
	} else if strings.Index(f, AssetDir) == 0 {
		// 0.2.2以降フラット構造: assets/{assetId}
		// 0.4.8以降メタファイル: assets/meta/{noteId}
		if strings.HasPrefix(f, AssetDir+"/"+MetaSubDir+"/") {
			return nil, fmt.Errorf("MetaFile skip [%s]", f)
		}
		mod.Typ = "asset"
		mod.Id = fn
	} else if strings.Index(f, TemplateDir) == 0 {
		mod.Typ = "template"
		//".tmpl"
		mod.Id = fn[:len(fn)-5]
	} else {
		return nil, fmt.Errorf("ModelType not found.[%s]", f)
	}

	return &mod, nil
}

func (f *FileSystem) commit(m string, sig *object.Signature, all bool, files ...string) error {

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("Status() error: %w", err)
	}

	commitOk := false
	if all {
		commitOk = true
	} else {

		gp := convertPaths(files...)
		for _, f := range gp {

			s, ok := status[f]
			if !ok {
				continue
			}

			//fmt.Printf("%c %c\n", s.Worktree, s.Staging)
			if s.Worktree == git.Modified {
				_, err := w.Add(f)
				if err != nil {
					return xerrors.Errorf("Modified Add(%s) error: %w", f, err)
				}
				commitOk = true
			} else if s.Worktree == git.Deleted {
				//w.Remove(f)
				//w.Add(f)
				//w.Clean(&git.CleanOptions{})
				commitOk = true
			} else if s.Staging == git.Added {
				log.Warn("s.Staging is added")
				commitOk = true
			} else if s.Staging == git.Modified {
				// 事前に w.Add() でステージング済みのファイル
				commitOk = true
			} else if s.Staging == git.Deleted {
				// 事前に w.Remove() でステージング済みの削除
				commitOk = true
			} else if s.Staging == git.Untracked {
				log.Warn("s.Staging is untracked?")
				//commitOk = true
			}
		}
	}

	if !commitOk {
		// update file nothing
		log.Warn("update file nothing")
		return UpdatedFilesError
	}

	_, err = w.Commit(m,
		&git.CommitOptions{
			All:    all,
			Author: sig,
		})
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (f *FileSystem) remove(files ...string) error {

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	for _, f := range files {
		w.Remove(f)
	}
	return nil
}

// 存在するファイルをadd()する
func (f *FileSystem) add(files ...string) error {

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	for _, n := range files {
		_, err = w.Add(n)
		if err != nil {
			return xerrors.Errorf("Add(%s) error: %w", n, err)
		}
	}
	return nil
}

func (f *FileSystem) GetNowPatch(file string) (string, string, error) {

	fn := convertPath(file)

	var now strings.Builder
	//現在のファイルシステムから取得
	err := f.readFile(&now, fn)
	if err != nil {
		return "", "", xerrors.Errorf("readTextFile() error: %w", err)
	}

	source := now.String()

	p, err := f.getLatestPatch(fn, source)
	if err != nil {
		return "", "", xerrors.Errorf("Patch() error: %w", err)
	}

	var w strings.Builder
	err = writePatch(&w, p)
	if err != nil {
		return "", "", xerrors.Errorf("writePatch() error: %w", err)
	}
	return source, w.String(), nil
}

// GetFileHistory は指定ファイルのgit履歴を limit 件取得する。
// offset でスキップ件数を指定する。hasMore は次のページが存在するかを示す。
func (f *FileSystem) GetFileHistory(file string, limit, offset int) ([]*CommitInfo, bool, error) {

	fn := convertPath(file)

	result, hasMore, err := f.getFileHistory(fn, limit, offset)
	if err != nil {
		return nil, false, xerrors.Errorf("getFileHistory() error: %w", err)
	}
	return result, hasMore, nil
}

// RestoreFile は指定ハッシュのコミット時点のファイル内容で現在のファイルを上書きする。
// コミットは行わない。
func (f *FileSystem) RestoreFile(file string, hash string) error {

	fn := convertPath(file)

	c, err := f.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return xerrors.Errorf("CommitObject() error: %w", err)
	}

	historical, err := getCommitContent(c, fn)
	if err != nil {
		return xerrors.Errorf("getCommitContent() error: %w", err)
	}

	err = f.writeFile(fn, strings.NewReader(historical))
	if err != nil {
		return xerrors.Errorf("writeFile() error: %w", err)
	}
	return nil
}

// GetHistoryPatch は指定ハッシュのコミット時点と現在のファイルの差分を返す
// returns: (現在のファイル内容, 指定コミット時点のファイル内容, unified patch string, error)
func (f *FileSystem) GetHistoryPatch(file string, hash string) (string, string, string, error) {

	fn := convertPath(file)

	var now strings.Builder
	// 現在のファイルシステムから取得（表示用 source）
	err := f.readFile(&now, fn)
	if err != nil {
		return "", "", "", xerrors.Errorf("readFile() error: %w", err)
	}

	source := now.String()

	// 指定コミット時点のファイル内容を取得
	c, err := f.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return "", "", "", xerrors.Errorf("CommitObject() error: %w", err)
	}
	historical, err := getCommitContent(c, fn)
	if err != nil {
		return "", "", "", xerrors.Errorf("getCommitContent() error: %w", err)
	}

	// historical → source のパッチを生成（過去 → 現在方向）
	// buildDiffView は source を "to" ファイルとして扱うため、パッチは historical を from にする必要がある
	p, err := createSinglePatch(fn, historical, source)
	if err != nil {
		return "", "", "", xerrors.Errorf("createSinglePatch() error: %w", err)
	}

	var w strings.Builder
	err = writePatch(&w, p)
	if err != nil {
		return "", "", "", xerrors.Errorf("writePatch() error: %w", err)
	}
	return source, historical, w.String(), nil
}

// Patch内からFilePatchを探す
func filterFilePatch(name string, patch diff.Patch) (diff.FilePatch, error) {

	for _, fp := range patch.FilePatches() {

		from, to := fp.Files()

		if from != nil {
			if from.Path() == name {
				return fp, nil
			}
		}
		if to != nil {
			if to.Path() == name {
				return fp, nil
			}
		}
	}

	return nil, fmt.Errorf("Not Found FilePatch: %s", name)
}

func writePatch(w io.Writer, p diff.Patch) error {
	ue := diff.NewUnifiedEncoder(w, diff.DefaultContextLines)
	err := ue.Encode(p)
	if err != nil {
		return xerrors.Errorf("Encode() error: %w", err)
	}
	return nil
}
