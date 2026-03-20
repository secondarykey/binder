package binder

import (
	. "binder/internal"

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

	f, err := fs.Clone(dir, url)
	if err != nil {
		return xerrors.Errorf("fs.Clone() error: %w", err)
	}

	//TODO ブランチがリモートに存在する場合の確認方法

	//ファイルシステムをチェック
	err = checkDirectory(dir, false)
	if err != nil {
		//インストール処理を行う
		err := install(f, dir, version)
		if err != nil {
			return xerrors.Errorf("binder.install() error: %w", err)
		}
	}

	return nil
}

func CheckConvert(dir string, ver *Version) (bool, error) {
	convertFlag, err := setup.CheckConvert(dir, ver)
	if err != nil {
		return false, xerrors.Errorf("setup.Check() error: %w", err)
	}
	return convertFlag, nil
}

func Convert(dir string, ver *Version) error {
	// CSVスキーマ変換 + ファイルシステム移行 + binder.json更新 + マイグレーションコミット
	// （0.2.2 アセットフラット化 / 0.4.5 config.csv退避 / binder.jsonバージョン更新）
	if err := setup.Convert(dir, ver); err != nil {
		return xerrors.Errorf("convert.Run() error: %w", err)
	}
	return nil
}

func Load(dir string) (*Binder, error) {

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.Load() error: %w", err)
	}

	err = checkDirectory(dir, false)
	if err != nil {
		return nil, xerrors.Errorf("checkDirectory() error: %w", err)
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

func (b *Binder) generateId() string {

	id, err := uuid.NewV7()
	if err != nil {
		slog.Error("UUID v7 generate error: " + err.Error())
		return ""
	}
	return id.String()
}
