package binder

import (
	. "binder/internal"

	"binder/api/json"
	"binder/db"
	"binder/fs"
	"binder/log"
	"binder/setup"
	"context"
	"fmt"
	"log/slog"
	"net/http"

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

func CreateRemote(url, dir string, version *Version) error {

	_, err := fs.Clone(dir, url)
	if err != nil {
		return xerrors.Errorf("fs.Clone() error: %w", err)
	}

	//TODO ブランチがリモートに存在する場合の確認方法

	// リモートから取得した場合、既にBinderのファイルシステムであるはず
	err = setup.CheckDirectory(dir, false)
	if err != nil {
		return xerrors.Errorf("setup.CheckDirectory() error: %w", err)
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

	//TODO ユーザ情報から取得
	b.op = createUserOp("user")

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

func (b *Binder) generateId() string {

	id, err := uuid.NewV7()
	if err != nil {
		slog.Error("UUID v7 generate error: " + err.Error())
		return ""
	}
	return id.String()
}
