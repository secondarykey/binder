package fs

import (
	"io"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/format/diff"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/utils/merkletrie"
	utils "github.com/go-git/go-git/v5/utils/diff"
	dmp "github.com/sergi/go-diff/diffmatchpatch"
	"golang.org/x/xerrors"
)

// CommitInfo はファイル履歴の1エントリを表す
type CommitInfo struct {
	Hash    string
	Message string
	When    time.Time
}

// CommitFile はコミット内の変更ファイル1件を表す
type CommitFile struct {
	Path   string // git path
	Typ    string // note, diagram, asset, template
	Id     string
	Action string // added, modified, deleted
}

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

// 指定ファイルの全コミット履歴を取得
// getFileHistory は指定ファイルのコミット履歴を limit 件取得する。
// offset でスキップ件数を指定する。hasMore は次のページが存在するかを示す。
func (f *FileSystem) getFileHistory(n string, limit, offset int) ([]*CommitInfo, bool, error) {

	ref, err := f.repo.Head()
	if err != nil {
		return nil, false, xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := f.repo.Log(&git.LogOptions{
		PathFilter: func(path string) bool {
			return path == n
		},
		From: ref.Hash(),
	})
	if err != nil {
		return nil, false, xerrors.Errorf("repo.Log() error: %w", err)
	}

	// offset 件スキップ
	for i := 0; i < offset; i++ {
		if _, err := itr.Next(); err != nil {
			if err == io.EOF {
				return nil, false, nil
			}
			return nil, false, xerrors.Errorf("itr.Next() error: %w", err)
		}
	}

	// limit+1 件取得して hasMore を判定
	var result []*CommitInfo
	for {
		c, err := itr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, false, xerrors.Errorf("itr.Next() error: %w", err)
		}
		result = append(result, &CommitInfo{
			Hash:    c.Hash.String(),
			Message: c.Message,
			When:    c.Author.When,
		})
		if len(result) == limit+1 {
			break
		}
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}
	return result, hasMore, nil
}

// getOverallHistory はリポジトリ全体のコミット履歴を limit 件取得する。
func (f *FileSystem) getOverallHistory(limit, offset int) ([]*CommitInfo, bool, error) {

	ref, err := f.repo.Head()
	if err != nil {
		return nil, false, xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := f.repo.Log(&git.LogOptions{
		From: ref.Hash(),
	})
	if err != nil {
		return nil, false, xerrors.Errorf("repo.Log() error: %w", err)
	}

	// offset 件スキップ
	for i := 0; i < offset; i++ {
		if _, err := itr.Next(); err != nil {
			if err == io.EOF {
				return nil, false, nil
			}
			return nil, false, xerrors.Errorf("itr.Next() error: %w", err)
		}
	}

	// limit+1 件取得して hasMore を判定
	var result []*CommitInfo
	for {
		c, err := itr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, false, xerrors.Errorf("itr.Next() error: %w", err)
		}
		result = append(result, &CommitInfo{
			Hash:    c.Hash.String(),
			Message: c.Message,
			When:    c.Author.When,
		})
		if len(result) == limit+1 {
			break
		}
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}
	return result, hasMore, nil
}

// getCommitFiles は指定コミットで変更されたファイル一覧を返す。
// DB CSV 等の管理ファイルは除外し、note/diagram/asset/template のみ返す。
func (f *FileSystem) getCommitFiles(hash string) ([]*CommitFile, error) {

	c, err := f.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return nil, xerrors.Errorf("CommitObject() error: %w", err)
	}

	commitTree, err := c.Tree()
	if err != nil {
		return nil, xerrors.Errorf("commit.Tree() error: %w", err)
	}

	// 親コミットのツリーを取得（初回コミットは空ツリー）
	var parentTree *object.Tree
	parent, err := c.Parents().Next()
	if err == nil {
		parentTree, err = parent.Tree()
		if err != nil {
			return nil, xerrors.Errorf("parent.Tree() error: %w", err)
		}
	} else {
		// 初回コミット: 空ツリーとの比較
		parentTree = &object.Tree{}
	}

	changes, err := parentTree.Diff(commitTree)
	if err != nil {
		return nil, xerrors.Errorf("Tree.Diff() error: %w", err)
	}

	var result []*CommitFile
	for _, change := range changes {
		action, err := change.Action()
		if err != nil {
			continue
		}

		path := changePath(change)
		mod, err := getModelType(path)
		if err != nil {
			// DB CSV 等の管理ファイルはスキップ
			continue
		}

		var actionStr string
		switch action {
		case merkletrie.Insert:
			actionStr = "added"
		case merkletrie.Delete:
			actionStr = "deleted"
		case merkletrie.Modify:
			actionStr = "modified"
		default:
			continue
		}

		result = append(result, &CommitFile{
			Path:   path,
			Typ:    mod.Typ,
			Id:     mod.Id,
			Action: actionStr,
		})
	}
	return result, nil
}

// restoreToCommit は指定コミットの状態にワーキングツリーを復元し、auto-commit する。
func (f *FileSystem) restoreToCommit(hash string) error {

	targetCommit, err := f.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return xerrors.Errorf("CommitObject() error: %w", err)
	}
	targetTree, err := targetCommit.Tree()
	if err != nil {
		return xerrors.Errorf("target.Tree() error: %w", err)
	}

	// 現在 HEAD のツリーを取得
	headRef, err := f.repo.Head()
	if err != nil {
		return xerrors.Errorf("repo.Head() error: %w", err)
	}
	headCommit, err := f.repo.CommitObject(headRef.Hash())
	if err != nil {
		return xerrors.Errorf("head CommitObject() error: %w", err)
	}
	headTree, err := headCommit.Tree()
	if err != nil {
		return xerrors.Errorf("head.Tree() error: %w", err)
	}

	w, err := f.repo.Worktree()
	if err != nil {
		return xerrors.Errorf("Worktree() error: %w", err)
	}

	// HEAD → target の差分を取得して適用
	changes, err := headTree.Diff(targetTree)
	if err != nil {
		return xerrors.Errorf("Tree.Diff() error: %w", err)
	}

	for _, change := range changes {
		action, err := change.Action()
		if err != nil {
			continue
		}

		switch action {
		case merkletrie.Insert, merkletrie.Modify:
			// target に存在するファイルを書き戻す
			path := change.To.Name
			file, err := targetCommit.File(path)
			if err != nil {
				continue
			}
			content, err := file.Contents()
			if err != nil {
				continue
			}
			if err := f.writeFile(path, strings.NewReader(content)); err != nil {
				return xerrors.Errorf("writeFile(%s) error: %w", path, err)
			}
			if _, err := w.Add(path); err != nil {
				return xerrors.Errorf("Add(%s) error: %w", path, err)
			}

		case merkletrie.Delete:
			// HEAD にはあるが target にはないファイルを削除
			path := change.From.Name
			if _, err := w.Remove(path); err != nil {
				// ファイルが既に存在しない場合は無視
				continue
			}
		}
	}

	shortHash := hash
	if len(shortHash) > 7 {
		shortHash = shortHash[:7]
	}
	return f.CommitAll("Restore to " + shortHash)
}

// 指定ハッシュのコミット時点のファイルと現在ファイルのパッチを作成
func (f *FileSystem) getCommitPatch(n string, hash string, now string) (diff.Patch, error) {

	c, err := f.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return nil, xerrors.Errorf("CommitObject() error: %w", err)
	}

	historical, err := getCommitContent(c, n)
	if err != nil {
		return nil, xerrors.Errorf("getCommitContent() error: %w", err)
	}

	p, err := createSinglePatch(n, historical, now)
	if err != nil {
		return nil, xerrors.Errorf("createSinglePatch() error: %w", err)
	}
	return p, nil
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
