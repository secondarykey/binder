package binder

import (
	"errors"
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

	// 0.4.5: config.csvをbinder.jsonに移行する前に値を読み込む
	var configName, configDetail string
	did045Migrate := ver != nil && ov.Lt(v045migrate)
	if did045Migrate {
		configName, configDetail = readConfigCSV(dbDir)
	}

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
	// 0.3.2マイグレーション: schemaフィールドを空にしてappバージョンのみで管理する。
	// 0.4.5マイグレーション: config.csvのname/detailをbinder.jsonに移行する。
	if ver != nil {
		meta.Schema = ""
		meta.Version = ver.String()
		if ov.Lt(v045migrate) && meta.Name == "" {
			if configName == "" {
				configName = "Binder"
			}
			meta.Name = configName
			meta.Detail = configDetail
		}
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

	// 0.4.5マイグレーション: config.csv削除とbinder.json更新をgitにコミット
	// config.csvの削除を明示的にステージし、binder.jsonの更新と合わせてコミットする。
	// 変更がない場合（新規インストール等）はUpdatedFilesErrorを無視する。
	if did045Migrate {
		// config.csv が追跡済みの場合は削除をステージ（未追跡の場合は無視）
		_ = bfs.RemoveFile("db/config.csv")
		// binder.json をステージ
		if err = bfs.AddFile(BinderMetaFile); err != nil {
			return nil, xerrors.Errorf("AddFile(binder.json) error: %w", err)
		}
		commitErr := bfs.AutoCommit(fs.M("Migrate Config to binder.json", "Schema"), BinderMetaFile)
		if commitErr != nil && !errors.Is(commitErr, fs.UpdatedFilesError) {
			return nil, xerrors.Errorf("AutoCommit(migrate) error: %w", commitErr)
		}
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
	b.dir = dir
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
