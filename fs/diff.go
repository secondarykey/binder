package fs

import (
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/format/diff"
	"github.com/go-git/go-git/v5/plumbing/object"
	utils "github.com/go-git/go-git/v5/utils/diff"
	dmp "github.com/sergi/go-diff/diffmatchpatch"
	"golang.org/x/xerrors"
)

// 指定ファイルの最終コミット取得
func (f *FileSystem) getLastCommit(n string) (*object.Commit, error) {

	ref, err := f.repo.Head()
	if err != nil {
		return nil, xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := f.repo.Log(&git.LogOptions{
		PathFilter: func(path string) bool {
			return path == n
		},
		From: ref.Hash()})
	if err != nil {
		return nil, xerrors.Errorf("repo.Log() error: %w", err)
	}

	//TODO チェック
	latest, err := itr.Next()
	if err != nil {
		return nil, xerrors.Errorf("Next() error: %w", err)
	}
	return latest, nil
}

func (f *FileSystem) getLastCommitContent(n string) (string, error) {

	latest, err := f.getLastCommit(n)
	if err != nil {
		return "", xerrors.Errorf("getLastCommit() error: %w", err)
	}

	c, err := getCommitContent(latest, n)
	if err != nil {
		return "", xerrors.Errorf("getCommitContent() error: %w", err)
	}
	return c, nil
}

// 指定したコミットのファイルの中身
func getCommitContent(c *object.Commit, n string) (string, error) {

	fo, err := c.File(n)
	if err != nil {
		return "", xerrors.Errorf("commit.File() error: %w", err)
	}

	content, err := fo.Contents()
	if err != nil {
		return "", xerrors.Errorf("Contents() error: %w", err)
	}
	return content, nil
}

// 最終コミットと引数のパッチ
func (f *FileSystem) getLatestPatch(n string, now string) (diff.Patch, error) {

	//コミットから取得
	fromContent, err := f.getLastCommitContent(n)
	if err != nil {
		return nil, xerrors.Errorf("getLastContent() error: %w", err)
	}

	p, err := createSinglePatch(n, fromContent, now)
	if err != nil {
		return nil, xerrors.Errorf("patch() error: %w", err)
	}
	return p, nil
}

// 指定ファイル名でパッチを作成
// 現状特にハッシュを指定してない
func createSinglePatch(n string, from, to string) (diff.Patch, error) {

	fromFile := newPatchFile(n)
	toFile := newPatchFile(n)

	var fp filePatch
	fp.from = fromFile
	fp.to = toFile
	fp.chunks = createChunks(from, to)

	return newSinglePatch(&fp), nil
}

// LICENSE
// https://github.com/go-git/go-git/tree/master?tab=Apache-2.0-1-ov-file#readme
// https://github.com/go-git/go-git/blob/master/plumbing/object/patch.go#L68
func createChunks(from string, to string) []diff.Chunk {

	diffs := utils.Do(from, to)

	var chunks []diff.Chunk
	for _, d := range diffs {

		var op diff.Operation
		switch d.Type {
		case dmp.DiffEqual:
			op = diff.Equal
		case dmp.DiffDelete:
			op = diff.Delete
		case dmp.DiffInsert:
			op = diff.Add
		}
		chunks = append(chunks, &chunk{d.Text, op})
	}
	return chunks
}

type singlePatch struct {
	fp diff.FilePatch
}

func newSinglePatch(fp diff.FilePatch) diff.Patch {
	var p singlePatch
	p.fp = fp
	return &p
}

func (p *singlePatch) FilePatches() []diff.FilePatch {
	return []diff.FilePatch{p.fp}
}

func (p *singlePatch) Message() string {
	return "Binder Patch"
}

type filePatch struct {
	from   *patchFile
	to     *patchFile
	chunks []diff.Chunk
}

// only text
func (f *filePatch) IsBinary() bool {
	return false
}

func (f *filePatch) Files() (diff.File, diff.File) {
	return f.from, f.to
}

func (f *filePatch) Chunks() []diff.Chunk {
	return f.chunks
}

type patchFile struct {
	path string
	hash plumbing.Hash
}

func newPatchFile(p string) *patchFile {
	var f patchFile
	f.path = p
	return &f
}

func (f *patchFile) Hash() plumbing.Hash {
	return f.hash
}

func (f *patchFile) Mode() filemode.FileMode {
	return filemode.Regular
}

func (f *patchFile) Path() string {
	return f.path
}

type chunk struct {
	content string
	typ     diff.Operation
}

func (c chunk) Content() string {
	return c.content
}
func (c chunk) Type() diff.Operation {
	return c.typ
}
