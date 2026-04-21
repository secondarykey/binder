package binder

import (
	"binder/api/json"
	"binder/fs"
	"binder/setup"

	"golang.org/x/xerrors"
)

func (b *Binder) EditConfig(conf *json.Config) error {

	if b == nil {
		return EmptyError
	}

	meta, err := b.fileSystem.LoadMetaData()
	if err != nil {
		return xerrors.Errorf("LoadMetaData() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	meta.Name = conf.Name
	meta.Detail = conf.Detail
	meta.MarkedURL = conf.MarkedURL
	meta.MermaidURL = conf.MermaidURL
	meta.OptimizeImage = &conf.OptimizeImage

	if err = b.fileSystem.SaveMetaData(meta); err != nil {
		return xerrors.Errorf("SaveMetaData() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Update Config", "Main"), fs.BinderMetaFile)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

func (b *Binder) GetConfig() (*json.Config, error) {
	if b == nil {
		return nil, EmptyError
	}

	meta, err := b.fileSystem.LoadMetaData()
	if err != nil {
		return nil, xerrors.Errorf("LoadMetaData() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	var conf json.Config
	conf.Name = meta.Name
	conf.Detail = meta.Detail
	conf.MarkedURL = meta.MarkedURL
	conf.MermaidURL = meta.MermaidURL
	// nil（未設定）の場合はデフォルト true
	if meta.OptimizeImage == nil || *meta.OptimizeImage {
		conf.OptimizeImage = true
	}
	return &conf, nil
}

// GetPublishSettings は binder.json から公開設定を返す。
func (b *Binder) GetPublishSettings() (bool, string, error) {
	if b == nil {
		return false, "", EmptyError
	}

	meta, err := b.fileSystem.LoadMetaData()
	if err != nil {
		return false, "", xerrors.Errorf("LoadMetaData() error: %w", err)
	}
	if meta == nil {
		return false, "", nil
	}
	return meta.PublishOnly, meta.PublishBranch, nil
}

// SavePublishSettings は公開設定を binder.json に保存しコミットする。
// 設定が変更されていない場合はコミットをスキップする。
func (b *Binder) SavePublishSettings(publishOnly bool, publishBranch string) error {
	if b == nil {
		return EmptyError
	}

	meta, err := b.fileSystem.LoadMetaData()
	if err != nil {
		return xerrors.Errorf("LoadMetaData() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	// 変更がなければコミット不要
	if meta.PublishOnly == publishOnly && meta.PublishBranch == publishBranch {
		return nil
	}

	meta.PublishOnly = publishOnly
	meta.PublishBranch = publishBranch

	if err = b.fileSystem.SaveMetaData(meta); err != nil {
		return xerrors.Errorf("SaveMetaData() error: %w", err)
	}

	if err = b.fileSystem.Commit(fs.M("Update Publish Settings", "Main"), fs.BinderMetaFile); err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (b *Binder) GetUserInfo() (*json.UserInfo, error) {
	if b == nil {
		return nil, EmptyError
	}

	key, err := setup.GetUserKey()
	if err != nil {
		return nil, xerrors.Errorf("setup.GetUserKey() error: %w", err)
	}

	info, err := b.fileSystem.LoadUserData(key)
	if err != nil {
		return nil, xerrors.Errorf("LoadUserData() error: %w", err)
	}
	if info == nil {
		return &json.UserInfo{}, nil
	}

	return &json.UserInfo{
		Name:       info.Name,
		Email:      info.Email,
		AuthType:   string(info.AuthType),
		Username:   info.Username,
		Password:   info.Password,
		Token:      info.Token,
		Passphrase: info.Passphrase,
		Filename:   info.Filename,
		Bytes:      info.Bytes,
	}, nil
}

func (b *Binder) EditUserInfo(u *json.UserInfo) error {
	if b == nil {
		return EmptyError
	}

	key, err := setup.GetUserKey()
	if err != nil {
		return xerrors.Errorf("setup.GetUserKey() error: %w", err)
	}

	info := &fs.UserInfo{
		Name:       u.Name,
		Email:      u.Email,
		AuthType:   fs.AuthType(u.AuthType),
		Username:   u.Username,
		Password:   u.Password,
		Token:      u.Token,
		Passphrase: u.Passphrase,
		Filename:   u.Filename,
		Bytes:      u.Bytes,
	}
	if err = b.fileSystem.SaveUserData(key, info); err != nil {
		return xerrors.Errorf("SaveUserData() error: %w", err)
	}

	// コミット署名を即時反映
	b.fileSystem.SetUserSig(info)

	// DB操作のユーザ名を即時反映
	b.op = createUserOp(b.fileSystem.UserName())

	return nil
}
