package binder

import (
	. "binder/internal"

	"binder/db"
	"binder/db/convert"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

var EmptyError = fmt.Errorf("Binder is empty")

type Binder struct {
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
	} else {
		//ブランチの切替(install時は切り替わっている)
		s := settings.Get()
		err = f.Branch(s.Git.Branch)
		if err != nil {
			return xerrors.Errorf("fs.Branch() error: %w", err)
		}
	}

	return nil
}

func Load(dir string, ver *Version) (*Binder, error) {

	// binder.jsonからメタ情報を読み込む（存在しない場合は旧スキーマファイルから生成）
	meta, err := loadMeta(dir)
	if err != nil {
		return nil, xerrors.Errorf("loadMeta() error: %w", err)
	}

	ov, err := meta.schemaVersion()
	if err != nil {
		return nil, xerrors.Errorf("meta.schemaVersion() error: %w", err)
	}

	//変換処理を開く前に入れておく
	dbDir := dir + "/db"
	err = convert.Run(dbDir, ov, ver)
	if err != nil {
		return nil, xerrors.Errorf("db Convert() error: %w", err)
	}

	// ファイルシステム移行: アセットディレクトリのフラット化（0.2.2）
	if ver != nil && ov.Lt(v022migrate) {
		if err = migrateFilesystemV022(dir); err != nil {
			return nil, xerrors.Errorf("migrateFilesystemV022() error: %w", err)
		}
	}

	// binder.jsonを更新（スキーマ変換後、または初回作成）
	if ver != nil {
		meta.Schema = ver.String()
		meta.Version = ver.String()
		if err = saveMeta(dir, meta); err != nil {
			return nil, xerrors.Errorf("saveMeta() error: %w", err)
		}
		// binder.jsonへの移行後に旧スキーマファイルを削除
		removeOldSchemaFiles(dir)
	}

	bfs, err := fs.Load(dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.Load() error: %w", err)
	}

	s := settings.Get()
	//ブランチを切り替え
	err = bfs.Branch(s.Git.Branch)
	if err != nil {
		return nil, xerrors.Errorf("Branch -> %s error: %w", s.Git.Branch, err)
	}

	err = checkDirectory(dir, false)
	if err != nil {
		return nil, xerrors.Errorf("checkDirectory() error: %w", err)
	}

	/*
		if nf != "" {
			err = bfs.SchemaCommit(nf)
			if err != nil {
				return nil, xerrors.Errorf("fs.SchemaCommit() error: %w", err)
			}
		}
	*/

	inst, err := db.New(dbDir)
	if err != nil {
		return nil, xerrors.Errorf("db.New() error: %w", err)
	}
	err = inst.Open()
	if err != nil {
		return nil, xerrors.Errorf("db.Open() error: %w", err)
	}

	var b Binder
	b.fileSystem = bfs
	b.db = inst
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

func (b *Binder) SaveSetting(s *settings.Setting) error {

	if b == nil {
		return EmptyError
	}

	err := s.Save()
	if err != nil {
		return xerrors.Errorf("settings.Save() error: %w", err)
	}
	return nil
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
