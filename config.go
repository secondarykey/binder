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

	meta, err := fs.LoadMeta(b.dir)
	if err != nil {
		return xerrors.Errorf("fs.LoadMeta() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	meta.Name = conf.Name
	meta.Detail = conf.Detail

	if err = fs.SaveMeta(b.dir, meta); err != nil {
		return xerrors.Errorf("fs.SaveMeta() error: %w", err)
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

	meta, err := fs.LoadMeta(b.dir)
	if err != nil {
		return nil, xerrors.Errorf("fs.LoadMeta() error: %w", err)
	}
	if meta == nil {
		meta = &fs.BinderMeta{}
	}

	var conf json.Config
	conf.Name = meta.Name
	conf.Detail = meta.Detail
	return &conf, nil
}

func (b *Binder) GetUserInfo() (*json.UserInfo, error) {
	if b == nil {
		return nil, EmptyError
	}

	key, err := setup.GetUserKey()
	if err != nil {
		return nil, xerrors.Errorf("setup.GetUserKey() error: %w", err)
	}

	info, err := fs.LoadUserInfo(b.dir, key)
	if err != nil {
		return nil, xerrors.Errorf("fs.LoadUserInfo() error: %w", err)
	}
	if info == nil {
		return &json.UserInfo{}, nil
	}

	return &json.UserInfo{
		Name:  info.Name,
		Email: info.Email,
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
		Name:  u.Name,
		Email: u.Email,
	}
	if err = fs.SaveUserInfo(b.dir, key, info); err != nil {
		return xerrors.Errorf("fs.SaveUserInfo() error: %w", err)
	}

	return nil
}
