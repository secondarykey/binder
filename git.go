package binder

import (
	"binder/fs"
	"binder/log"

	"fmt"
	"time"

	"golang.org/x/xerrors"
)

func (b *Binder) ToFile(mode string, id string) string {
	f := ""
	switch mode {
	case "note":
		f = fs.NoteFile(id)
	case "diagram":
		f = fs.DiagramFile(id)
	case "asset":
		f = b.AssetFile(id)
	case "template":
		f = fs.TemplateFile(id)
	default:
		log.Warn("leaf is template type? " + mode)
	}
	return f
}

func (b *Binder) CommitFiles(m string, files ...string) error {
	err := b.fileSystem.Commit(m, files...)
	if err != nil {
		return xerrors.Errorf("fs.Commit() error: %w", err)
	}
	return nil
}

type Patch struct {
	Patch      string `json:"patch"`
	Source     string `json:"source"`
	Historical string `json:"historical"`
}

func (b *Binder) getFilename(typ, id string) (string, error) {
	fn := ""
	switch typ {
	case "note":
		fn = fs.NoteFile(id)
	case "diagram":
		fn = fs.DiagramFile(id)
	case "asset":
		a, err := b.db.GetAssetWithParent(id)
		if err != nil {
			return "", xerrors.Errorf("GetAssetWithParent() error: %w", err)
		}
		fn = fs.AssetFile(a)
	case "template":
		fn = fs.TemplateFile(id)
	default:
		return "", fmt.Errorf("Not Found Type: %s", typ)
	}

	return fn, nil
}

func (b *Binder) GetModifiedIds() ([]string, error) {
	if b == nil {
		return nil, EmptyError
	}
	files, err := b.fileSystem.Status()
	if err != nil {
		return nil, xerrors.Errorf("fs.Status() error: %w", err)
	}
	ids := make([]string, len(files))
	for i, f := range files {
		ids[i] = f.Id
	}
	return ids, nil
}

func (b *Binder) GetNowPatch(typ string, id string) (*Patch, error) {

	fn, err := b.getFilename(typ, id)
	if err != nil {
		return nil, xerrors.Errorf("getFilename() error: %w", err)
	}

	now, patch, err := b.fileSystem.GetNowPatch(fn)
	if err != nil {
		return nil, xerrors.Errorf("WriteFilePatch() error: %w", err)
	}

	var p Patch
	p.Patch = patch
	p.Source = now

	return &p, nil
}

// RestoreHistory は指定コミット時点のファイル内容で現在のファイルを上書きする。
// コミットは行わない（呼び出し元が任意でコミットする）。
func (b *Binder) RestoreHistory(typ, id, hash string) error {

	fn, err := b.getFilename(typ, id)
	if err != nil {
		return xerrors.Errorf("getFilename() error: %w", err)
	}

	err = b.fileSystem.RestoreFile(fn, hash)
	if err != nil {
		return xerrors.Errorf("RestoreFile() error: %w", err)
	}
	return nil
}

func (b *Binder) GetCleanupInfo(before time.Time) (*fs.CleanupInfo, error) {
	info, err := b.fileSystem.GetCleanupInfo(before)
	if err != nil {
		return nil, xerrors.Errorf("GetCleanupInfo() error: %w", err)
	}
	return info, nil
}

func (b *Binder) GetOverallHistory(limit, offset int) ([]*fs.CommitInfo, bool, error) {

	result, hasMore, err := b.fileSystem.GetOverallHistory(limit, offset)
	if err != nil {
		return nil, false, xerrors.Errorf("GetOverallHistory() error: %w", err)
	}
	return result, hasMore, nil
}

func (b *Binder) GetCommitFiles(hash string) ([]*fs.CommitFile, error) {

	files, err := b.fileSystem.GetCommitFiles(hash)
	if err != nil {
		return nil, xerrors.Errorf("GetCommitFiles() error: %w", err)
	}
	return files, nil
}

func (b *Binder) GetHistory(typ, id string, limit, offset int) ([]*fs.CommitInfo, bool, error) {

	fn, err := b.getFilename(typ, id)
	if err != nil {
		return nil, false, xerrors.Errorf("getFilename() error: %w", err)
	}

	result, hasMore, err := b.fileSystem.GetFileHistory(fn, limit, offset)
	if err != nil {
		return nil, false, xerrors.Errorf("GetFileHistory() error: %w", err)
	}
	return result, hasMore, nil
}

func (b *Binder) GetHistoryPatch(typ, id, hash string) (*Patch, error) {

	fn, err := b.getFilename(typ, id)
	if err != nil {
		return nil, xerrors.Errorf("getFilename() error: %w", err)
	}

	source, historical, patch, err := b.fileSystem.GetHistoryPatch(fn, hash)
	if err != nil {
		return nil, xerrors.Errorf("GetHistoryPatch() error: %w", err)
	}

	var p Patch
	p.Patch = patch
	p.Source = source
	p.Historical = historical

	return &p, nil
}
