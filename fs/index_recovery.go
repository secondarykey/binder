package fs

import (
	"binder/log"
	"errors"
	"io"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/index"
	"golang.org/x/xerrors"
)

// gitインデックス破損時の退避先ファイル名（.git/index.broken）
const brokenIndexFile = "index.broken"

// repairIndexIfCorrupt は .git/index の破損を検出した場合のみ自動復旧する。
// Load() から一度だけ呼ばれる（詳細は fs/CLAUDE.md のトラブルシュート節を参照）。
//
// go-git はインデックスを truncate + 直接書き込みで更新するため、書き込み中の
// 電源断・強制終了・外部ツールの干渉で破損しうる。破損したままだとバインダーの
// 全操作が失敗するため、HEAD から再構築可能なインデックスに限り自動復旧する。
//
// 破損由来と判定できる sentinel エラー以外（I/O エラー等）では何もしない。
// 正常なインデックスを誤って壊すリスクを避けるため、判定を保守的にしている。
// 復旧に失敗してもロードは継続させたいので、エラーは返さず log.Warn にのみ記録する。
func (f *FileSystem) repairIndexIfCorrupt() {

	_, err := f.repo.Storer.Index()
	if err == nil {
		return
	}
	if !isCorruptIndexError(err) {
		return
	}

	log.Warn("FileSystem: corrupt git index detected, attempting auto-recovery: %+v", err)

	if berr := f.backupBrokenIndex(); berr != nil {
		log.Warn("FileSystem: failed to back up broken index (continuing): %+v", berr)
	}

	// go-git はインデックスファイル欠損時にこの空インデックスを返す仕様のため、
	// 空インデックスへの置換は手動復旧の「index 削除」と等価
	if err := f.repo.Storer.SetIndex(&index.Index{Version: 2}); err != nil {
		log.Warn("FileSystem: failed to reset index to empty, auto-recovery aborted: %+v", err)
		return
	}

	if _, err := f.repo.Head(); err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			// HEAD が無い新規リポジトリ（unborn branch）は空インデックスのままが正しい
			log.Warn("FileSystem: git index recovered to empty state (no HEAD yet)")
			f.invalidateStatus()
			return
		}
		log.Warn("FileSystem: Head() error during index recovery, index left empty: %+v", err)
		return
	}

	// Mixed reset で HEAD からインデックスを再構築する。ワークツリーのファイルには
	// 触らないため、破損時に書きかけだった変更は「未記録」として残る
	w, err := f.repo.Worktree()
	if err != nil {
		log.Warn("FileSystem: Worktree() error during index recovery, index left empty: %+v", err)
		return
	}
	if err := w.Reset(&git.ResetOptions{Mode: git.MixedReset}); err != nil {
		log.Warn("FileSystem: Reset(mixed) error during index recovery, index left empty: %+v", err)
		return
	}

	f.invalidateStatus()
	log.Warn("FileSystem: git index recovered from HEAD (mixed reset)")
}

func isCorruptIndexError(err error) bool {
	return errors.Is(err, index.ErrMalformedSignature) ||
		errors.Is(err, index.ErrInvalidChecksum) ||
		errors.Is(err, index.ErrUnknownExtension) ||
		errors.Is(err, index.ErrMalformedIndexFile)
}

// backupBrokenIndex は壊れた .git/index を .git/index.broken にコピーして退避する（安全策）。
func (f *FileSystem) backupBrokenIndex() error {

	dot, err := f.fs.Chroot(git.GitDirName)
	if err != nil {
		return xerrors.Errorf("Chroot() error: %w", err)
	}

	src, err := dot.Open("index")
	if err != nil {
		return xerrors.Errorf("Open(index) error: %w", err)
	}
	defer src.Close()

	dst, err := dot.Create(brokenIndexFile)
	if err != nil {
		return xerrors.Errorf("Create(%s) error: %w", brokenIndexFile, err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return xerrors.Errorf("io.Copy() error: %w", err)
	}
	return nil
}
