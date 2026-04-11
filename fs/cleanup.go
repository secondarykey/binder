package fs

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"golang.org/x/xerrors"
)

// CleanupInfo はクリーンアップ前の統計情報を保持する。
type CleanupInfo struct {
	TotalCommits int
	OldestCommit time.Time
	NewestCommit time.Time
	BranchName   string
	SquashTarget int   // カットオフ以前のコミット数（圧縮対象）
	KeepTarget   int   // カットオフ以降のコミット数（保持対象）
	ObjectsSize  int64 // .git/objects ディレクトリのサイズ（バイト）
}

// SquashResult は SquashHistory の実行結果を保持する。
type SquashResult struct {
	BeforeSize int64 // squash 前の .git/objects サイズ（バイト）
	AfterSize  int64 // squash + GC 後の .git/objects サイズ（バイト）
}

// GetCleanupInfo はコミット統計と指定日でのスカッシュ対象数を返す。
func (f *FileSystem) GetCleanupInfo(before time.Time) (*CleanupInfo, error) {

	commits, err := f.collectCommits()
	if err != nil {
		return nil, xerrors.Errorf("collectCommits() error: %w", err)
	}
	if len(commits) == 0 {
		return nil, fmt.Errorf("no commits found")
	}

	branch := f.branch
	if branch == "" {
		branch = "main"
	}

	info := &CleanupInfo{
		TotalCommits: len(commits),
		OldestCommit: commits[len(commits)-1].Author.When,
		NewestCommit: commits[0].Author.When,
		BranchName:   branch,
		ObjectsSize:  f.GetObjectsSize(),
	}

	// commits は新しい順（HEAD先頭）。before より古いコミットを数える
	for _, c := range commits {
		if c.Author.When.Before(before) {
			info.SquashTarget++
		} else {
			info.KeepTarget++
		}
	}

	return info, nil
}

// SquashHistory は before より古いコミットを1つのスカッシュコミットにまとめる。
// before 以降のコミットはDAGを書き換えて保持する。
// 実行前後の .git/objects サイズを SquashResult で返す。
func (f *FileSystem) SquashHistory(before time.Time) (*SquashResult, error) {

	beforeSize := f.GetObjectsSize()

	commits, err := f.collectCommits()
	if err != nil {
		return nil, xerrors.Errorf("collectCommits() error: %w", err)
	}
	if len(commits) < 2 {
		return nil, fmt.Errorf("not enough commits to squash")
	}

	// commits は新しい順。keep（before以降）と squash（before以前）に分割
	var keep, squash []*object.Commit
	for _, c := range commits {
		if c.Author.When.Before(before) {
			squash = append(squash, c)
		} else {
			keep = append(keep, c)
		}
	}

	if len(squash) == 0 {
		return nil, fmt.Errorf("no commits to squash")
	}

	// squash の最新コミット（= keep の直前）のツリーで orphan コミットを作成
	squashLatest := squash[0]
	orphanHash, err := f.createOrphanCommit(
		squashLatest.TreeHash,
		fmt.Sprintf("Squashed history before %s", before.Format("2006-01-02")),
	)
	if err != nil {
		return nil, xerrors.Errorf("createOrphanCommit() error: %w", err)
	}

	// keep が0件の場合: 全コミットが古い → orphan だけで完了
	if len(keep) == 0 {
		if err := f.updateBranchRef(orphanHash); err != nil {
			return nil, xerrors.Errorf("updateBranchRef() error: %w", err)
		}
		gcResult := f.GC()
		return &SquashResult{BeforeSize: beforeSize, AfterSize: gcResult.AfterSize}, nil
	}

	// keep 側を古い順に再作成（親ハッシュを差し替え）
	// keep は新しい順なので逆順に処理
	prevHash := orphanHash
	for i := len(keep) - 1; i >= 0; i-- {
		original := keep[i]
		newHash, err := f.rewriteCommit(original, prevHash)
		if err != nil {
			return nil, xerrors.Errorf("rewriteCommit() error: %w", err)
		}
		prevHash = newHash
	}

	// ブランチ ref を新しい HEAD に更新
	if err := f.updateBranchRef(prevHash); err != nil {
		return nil, xerrors.Errorf("updateBranchRef() error: %w", err)
	}

	// 不要オブジェクトの削除
	gcResult := f.GC()

	return &SquashResult{BeforeSize: beforeSize, AfterSize: gcResult.AfterSize}, nil
}

// GCResult は GC の実行結果を保持する。
type GCResult struct {
	BeforeSize int64 // GC 前の .git/objects サイズ（バイト）
	AfterSize  int64 // GC 後の .git/objects サイズ（バイト）
}

// GC は到達不能オブジェクトの削除とpackファイルの最適化を行う。
// git gc 相当の処理。前後の .git/objects サイズを返す。
func (f *FileSystem) GC() *GCResult {
	before := f.GetObjectsSize()
	_ = f.repo.Prune(git.PruneOptions{
		Handler: f.repo.DeleteObject,
	})
	_ = f.repo.RepackObjects(&git.RepackConfig{})
	return &GCResult{
		BeforeSize: before,
		AfterSize:  f.GetObjectsSize(),
	}
}

// GetObjectsSize は .git/objects ディレクトリの合計サイズ（バイト）を返す。
// base が空（メモリファイルシステム等）の場合は 0 を返す。
func (f *FileSystem) GetObjectsSize() int64 {
	if f.base == "" {
		return 0
	}
	objectsDir := filepath.Join(f.base, ".git", "objects")
	var total int64
	filepath.Walk(objectsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // エラーは無視してスキップ
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total
}

// collectCommits は HEAD から全コミットを新しい順に収集する。
func (f *FileSystem) collectCommits() ([]*object.Commit, error) {

	ref, err := f.repo.Head()
	if err != nil {
		return nil, xerrors.Errorf("repo.Head() error: %w", err)
	}

	itr, err := f.repo.Log(&git.LogOptions{
		From: ref.Hash(),
	})
	if err != nil {
		return nil, xerrors.Errorf("repo.Log() error: %w", err)
	}

	var commits []*object.Commit
	for {
		c, err := itr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, xerrors.Errorf("itr.Next() error: %w", err)
		}
		commits = append(commits, c)
	}

	return commits, nil
}

// createOrphanCommit は指定ツリーで親なしコミットを作成し、そのハッシュを返す。
func (f *FileSystem) createOrphanCommit(treeHash plumbing.Hash, message string) (plumbing.Hash, error) {

	sig := SystemSig()
	commitObj := &object.Commit{
		Author:    *sig,
		Committer: *sig,
		Message:   message,
		TreeHash:  treeHash,
		// ParentHashes なし = orphan コミット
	}

	obj := f.repo.Storer.NewEncodedObject()
	if err := commitObj.Encode(obj); err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("Commit.Encode() error: %w", err)
	}

	hash, err := f.repo.Storer.SetEncodedObject(obj)
	if err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("SetEncodedObject() error: %w", err)
	}

	return hash, nil
}

// rewriteCommit は元コミットの内容を保持しつつ、親を newParent に差し替えた新コミットを作成する。
func (f *FileSystem) rewriteCommit(original *object.Commit, newParent plumbing.Hash) (plumbing.Hash, error) {

	commitObj := &object.Commit{
		Author:       original.Author,
		Committer:    original.Committer,
		Message:      original.Message,
		TreeHash:     original.TreeHash,
		ParentHashes: []plumbing.Hash{newParent},
	}

	obj := f.repo.Storer.NewEncodedObject()
	if err := commitObj.Encode(obj); err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("Commit.Encode() error: %w", err)
	}

	hash, err := f.repo.Storer.SetEncodedObject(obj)
	if err != nil {
		return plumbing.ZeroHash, xerrors.Errorf("SetEncodedObject() error: %w", err)
	}

	return hash, nil
}

// updateBranchRef は現在のブランチ参照を newHash に更新する。
func (f *FileSystem) updateBranchRef(newHash plumbing.Hash) error {

	headRef, err := f.repo.Head()
	if err != nil {
		return xerrors.Errorf("repo.Head() error: %w", err)
	}

	ref := plumbing.NewHashReference(headRef.Name(), newHash)
	if err := f.repo.Storer.SetReference(ref); err != nil {
		return xerrors.Errorf("SetReference() error: %w", err)
	}

	return nil
}
