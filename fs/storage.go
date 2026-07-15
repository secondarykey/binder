package fs

import (
	"sync"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/plumbing/format/index"
	"github.com/go-git/go-git/v5/storage/filesystem"
)

// lockedStorage は go-git のストレージをラップし、gitインデックス（.git/index）の
// 読み書きを直列化する。
//
// go-git はインデックスを lock ファイルや一時ファイル経由のリネームを使わず、
// truncate + 直接書き込みで更新する。Wails のバインディング呼び出しは
// goroutine で並行実行されるため、複数の操作（コミット・add・status 等）が
// 同時に走るとインデックスファイルが交錯して破損する
// （"index uses ... extension, which we do not understand" / "index file corrupt"）。
// ストレージ層で読み書きを排他することで、どの上位経路からの操作でも
// ファイルレベルの破損を防ぐ。
type lockedStorage struct {
	*filesystem.Storage
	indexMu sync.Mutex
}

// newStorage は .git ディレクトリ（chroot 済み billy.Filesystem）から
// インデックス書き込みを直列化したストレージを生成する
func newStorage(dot billy.Filesystem) *lockedStorage {
	return &lockedStorage{
		Storage: filesystem.NewStorage(dot, cache.NewObjectLRUDefault()),
	}
}

func (s *lockedStorage) Index() (*index.Index, error) {
	s.indexMu.Lock()
	defer s.indexMu.Unlock()
	return s.Storage.Index()
}

func (s *lockedStorage) SetIndex(idx *index.Index) error {
	s.indexMu.Lock()
	defer s.indexMu.Unlock()
	return s.Storage.SetIndex(idx)
}
