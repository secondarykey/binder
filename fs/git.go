package fs

import (
	"binder/settings"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"golang.org/x/xerrors"
)

var NoUpdated = fmt.Errorf("updates to the file")
var UpdatedFilesError = fmt.Errorf("No updated files")

func M(header string, name string) string {
	return fmt.Sprintf("%s : %s", header, name)
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

func (f *FileSystem) Push(r, name string) error {

	set := settings.Get()
	auth := set.Git
	/*
		key, err := ssh.NewPublicKeysFromFile(auth.Name, auth.File, "")
		if err != nil {
			return xerrors.Errorf("repository Head() error: %w", err)
	    }*/
	key := &http.BasicAuth{
		Username: auth.Name,
		Password: auth.Code,
	}

	remote, err := f.repo.Remote(r)
	if err != nil {
		return xerrors.Errorf("Remote() error: %w", err)
	}

	//remotes/origin/- ではダメらしい
	refSpec := config.RefSpec(
		fmt.Sprintf("+refs/heads/%s:refs/heads/%s", name, name))
	err = remote.Push(&git.PushOptions{
		Progress: os.Stdout,
		RefSpecs: []config.RefSpec{config.RefSpec(refSpec)},
		Auth:     key,
	})

	if err != nil {
		return xerrors.Errorf("remote Push() error: %w", err)
	}

	return nil
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
	return f.commit(m, UserSig(), false, files...)
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
		slog.Info("names is zero")
	}
	return names, nil
}

func (f *FileSystem) Status() error {

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	status, err := w.Status()
	if err != nil {
		return xerrors.Errorf("Status() error: %w", err)
	}

	//notes,diagrams,templates 以外ないはず
	for f, s := range status {
		slog.Debug("Status", "File", f, "Staging", s.Staging, "Worktree", s.Worktree, "Extra", s.Extra)

		//fmt.Printf("%60s | %c %c %s\n", f, s.Staging, s.Worktree, s.Extra)
		typ, id, err := getModelType(f)
		if err != nil {
			slog.Warn(err.Error())
			//return xerrors.Errorf("getModelType() error: %w", err)
		} else {
			fmt.Printf("%s[%s]\n", id, typ)
		}
	}

	return nil
}

func getModelType(f string) (string, string, error) {
	data := strings.Split(f, "/")
	if len(data) < 2 {
		slog.Warn("Top Directory")
		return "", "", fmt.Errorf("Path error")
	}

	fn := data[1]
	if strings.Index(f, NoteDir) == 0 {
		//".md"
		return "note", fn[:len(fn)-3], nil
	} else if strings.Index(f, DiagramDir) == 0 {
		//".md"
		return "diagram", fn[:len(fn)-3], nil
	} else if strings.Index(f, AssetDir) == 0 {
		return "assets", data[2], nil
	} else if strings.Index(f, TemplateDir) == 0 {
		//".tmpl"
		return "template", fn[:len(fn)-5], nil
	}
	return "", "", fmt.Errorf("ModelType not found.[%s]", f)
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
				slog.Warn("s.Staging is added")
				commitOk = true
			} else if s.Staging == git.Untracked {
				slog.Warn("s.Staging is untracked?")
				//commitOk = true
			}
		}
	}

	if !commitOk {
		// update file nothing
		slog.Warn("update file nothing")
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
			return xerrors.Errorf("Add() error: %w", err)
		}
	}
	return nil
}
