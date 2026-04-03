package binder

import (
	. "binder/internal"

	"binder/api/json"
	"binder/db"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"binder/setup"
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

var EmptyError = fmt.Errorf("Binder is empty")

type Binder struct {
	dir               string
	fileSystem        *fs.FileSystem
	db                *db.Instance
	httpServer        *http.Server
	httpServerAddress string
	op                db.Op
}

type userOp struct {
	id string
}

func (op userOp) GetOperationId() string {
	return op.id
}

func createUserOp(userId string) db.Op {
	var op userOp
	op.id = userId
	return op
}

func CreateRemote(url, dir, branch, workBranch string, userInfo *json.UserInfo, save bool, version *Version) error {

	// json.UserInfo → fs.UserInfo に変換（Clone認証用）
	var fsInfo *fs.UserInfo
	if userInfo != nil {
		fsInfo = &fs.UserInfo{
			Name:       userInfo.Name,
			Email:      userInfo.Email,
			AuthType:   fs.AuthType(userInfo.AuthType),
			Username:   userInfo.Username,
			Password:   userInfo.Password,
			Token:      userInfo.Token,
			Passphrase: userInfo.Passphrase,
			Filename:   userInfo.Filename,
			Bytes:      userInfo.Bytes,
		}
	}

	bfs, err := fs.Clone(dir, url, branch, fsInfo)
	if err != nil {
		return xerrors.Errorf("fs.Clone() error: %w", err)
	}

	// リモートから取得した場合、既にBinderのファイルシステムであるはず
	err = setup.CheckDirectory(dir, false)
	if err != nil {
		return xerrors.Errorf("setup.CheckDirectory() error: %w", err)
	}

	// 作業ブランチが指定されていれば切り替え
	if workBranch != "" {
		err = bfs.Branch(workBranch)
		if err != nil {
			return xerrors.Errorf("fs.Branch(WorkBranch) error: %w", err)
		}
	}

	// ユーザ情報を暗号化して保存（認証情報の保存 or ユーザ名/メールの保存）
	key, err := setup.GetUserKey()
	if err != nil {
		log.WarnE("CreateRemote: GetUserKey", err)
	} else {
		if save && fsInfo != nil {
			// 認証情報ごと保存
			if err = bfs.SaveUserData(key, fsInfo); err != nil {
				log.WarnE("CreateRemote: SaveUserData", err)
			}
		} else {
			// save=false またはfsInfo==nil でもデフォルトのName/Emailで作成
			s := settings.Get()
			info := &fs.UserInfo{
				Name:  s.Git.Name,
				Email: s.Git.Mail,
			}
			if err = bfs.SaveUserData(key, info); err != nil {
				log.WarnE("CreateRemote: SaveUserData", err)
			}
		}
	}

	return nil
}

func Load(dir string) (*Binder, error) {

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.Load() error: %w", err)
	}

	err = setup.CheckDirectory(dir, false)
	if err != nil {
		return nil, xerrors.Errorf("setup.CheckDirectory() error: %w", err)
	}

	// docsディレクトリが存在しない場合は作成する（リモートClone時など）
	docsDir := filepath.Join(dir, bfs.GetPublic())
	if _, err := os.Stat(docsDir); os.IsNotExist(err) {
		if err := os.MkdirAll(docsDir, 0755); err != nil {
			return nil, xerrors.Errorf("os.MkdirAll(docs) error: %w", err)
		}
	}

	inst, err := db.New(bfs.DatabaseDir())
	if err != nil {
		return nil, xerrors.Errorf("db.New() error: %w", err)
	}

	err = inst.Open()
	if err != nil {
		return nil, xerrors.Errorf("db.Open() error: %w", err)
	}

	var b Binder
	b.dir = dir
	b.fileSystem = bfs
	b.db = inst

	// バインダーのユーザ情報をコミット署名に設定
	key, err := setup.GetUserKey()
	if err != nil {
		log.WarnE("Load: GetUserKey()", err)
	} else {
		info, err := bfs.LoadUserData(key)
		if err != nil {
			log.WarnE("Load: LoadUserData()", err)
		} else if info != nil {
			bfs.SetUserSig(info)
		} else {
			// user-data.enc が存在しない場合はデフォルト設定で作成
			s := settings.Get()
			info = &fs.UserInfo{
				Name:  s.Git.Name,
				Email: s.Git.Mail,
			}
			if err = bfs.SaveUserData(key, info); err != nil {
				log.WarnE("Load: SaveUserData()", err)
			}
			bfs.SetUserSig(info)
		}
	}

	b.op = createUserOp(bfs.UserName())

	return &b, nil
}

func (b *Binder) Close() error {

	if b == nil {
		return EmptyError
	}

	var rtnErr error

	fp := b.fileSystem
	hp := b.httpServer
	dp := b.db

	b.fileSystem = nil
	b.httpServer = nil
	b.db = nil
	b.op = nil

	if fp != nil {
		log.Notice("FileSystem Close()")
		err := fp.Close()
		if err != nil {
			log.PrintStackTrace(err)
			rtnErr = xerrors.Errorf("fs.Close() error: %w", err)
		}
	}

	if hp != nil {
		log.Notice("HTTP Shutdown()")
		err := hp.Shutdown(context.Background())
		if err != nil {
			log.PrintStackTrace(err)
			rtnErr = xerrors.Errorf("http.Shutdown() error: %w", err)
		}
	}

	if dp != nil {
		log.Notice("DB Close()")
		err := dp.Close()
		if err != nil {
			log.PrintStackTrace(err)
			rtnErr = xerrors.Errorf("db.Close() error: %w", err)
		}
	}

	return rtnErr
}

func (b *Binder) GetRemotes() ([]string, error) {

	if b == nil {
		return nil, EmptyError
	}

	configs, err := b.fileSystem.GetRemotes()
	if err != nil {
		return nil, xerrors.Errorf("fs.GetRemotes() error: %w", err)
	}

	names := make([]string, len(configs))
	for idx, c := range configs {
		names[idx] = c.Name
	}
	return names, nil
}

func (b *Binder) GetCurrentBranch() (string, error) {

	if b == nil {
		return "", EmptyError
	}

	name, err := b.fileSystem.CurrentBranch()
	if err != nil {
		return "", xerrors.Errorf("fs.CurrentBranch() error: %w", err)
	}
	return name, nil
}

func (b *Binder) ListBranches() ([]string, error) {

	if b == nil {
		return nil, EmptyError
	}

	branches, err := b.fileSystem.ListBranches()
	if err != nil {
		return nil, xerrors.Errorf("fs.ListBranches() error: %w", err)
	}
	return branches, nil
}

func (b *Binder) RenameBranch(oldName, newName string) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.RenameBranch(oldName, newName)
	if err != nil {
		return xerrors.Errorf("fs.RenameBranch() error: %w", err)
	}
	return nil
}

func (b *Binder) GetRemoteList() ([]*json.Remote, error) {

	if b == nil {
		return nil, EmptyError
	}

	configs, err := b.fileSystem.GetRemotes()
	if err != nil {
		return nil, xerrors.Errorf("fs.GetRemotes() error: %w", err)
	}

	remotes := make([]*json.Remote, len(configs))
	for idx, c := range configs {
		url := ""
		if len(c.URLs) > 0 {
			url = c.URLs[0]
		}
		remotes[idx] = &json.Remote{
			Name: c.Name,
			URL:  url,
		}
	}
	return remotes, nil
}

func (b *Binder) CreateRemote(name, url string) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.CreateRemote(name, url)
	if err != nil {
		return xerrors.Errorf("CreateRemote() error: %w", err)
	}
	return nil
}

func (b *Binder) EditRemote(name, url string) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.EditRemote(name, url)
	if err != nil {
		return xerrors.Errorf("EditRemote() error: %w", err)
	}
	return nil
}

func (b *Binder) DeleteRemote(name string) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.DeleteRemote(name)
	if err != nil {
		return xerrors.Errorf("DeleteRemote() error: %w", err)
	}
	return nil
}

// Push はリモートリポジトリにpushする。
// save が true の場合、認証情報を user_data.enc に保存する。
func (b *Binder) Push(remoteName string, info *json.UserInfo, save bool) error {

	if b == nil {
		return EmptyError
	}

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

	if save {
		key, err := setup.GetUserKey()
		if err != nil {
			return xerrors.Errorf("setup.GetUserKey() error: %w", err)
		}
		if err = b.fileSystem.SaveUserData(key, fsInfo); err != nil {
			return xerrors.Errorf("SaveUserData() error: %w", err)
		}
		b.fileSystem.SetUserSig(fsInfo)
	}

	branchName, err := b.fileSystem.CurrentBranch()
	if err != nil {
		return xerrors.Errorf("CurrentBranch() error: %w", err)
	}

	if err = b.fileSystem.Push(remoteName, branchName, fsInfo); err != nil {
		return xerrors.Errorf("Push() error: %w", err)
	}

	return nil
}

// Dir はバインダーのディレクトリパスを返す。
func (b *Binder) Dir() string {
	return b.dir
}

// Fetch はリモートブランチをフェッチする。
func (b *Binder) Fetch(remoteName, branchName string, info *fs.UserInfo) error {
	if b == nil {
		return EmptyError
	}
	return b.fileSystem.Fetch(remoteName, branchName, info)
}

// SaveUserInfo は認証情報を保存する。
func (b *Binder) SaveUserInfo(info *fs.UserInfo) {
	key, err := setup.GetUserKey()
	if err != nil {
		log.WarnE("setup.GetUserKey() error", err)
		return
	}
	if err = b.fileSystem.SaveUserData(key, info); err != nil {
		log.WarnE("SaveUserData() error", err)
		return
	}
	b.fileSystem.SetUserSig(info)
}

func (b *Binder) generateId() string {

	id, err := uuid.NewV7()
	if err != nil {
		log.ErrorE("UUID v7 generate error", err)
		return ""
	}
	return id.String()
}
