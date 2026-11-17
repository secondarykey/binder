package api

import (
	"errors"
	"strings"

	"binder"
	"binder/db"
	"binder/fs"
	"binder/settings"
	"binder/setup"
	"binder/setup/convert"
)

// API 層で発生するユーザ向け条件の sentinel。
// ドメイン層（binder/db/fs）の sentinel と同様に userError でメッセージへマッピングする。
var (
	// ErrUncommittedChanges はブランチ切替・マージ・復元などの前に未記録の変更が
	// 残っている場合のエラー。
	ErrUncommittedChanges = errors.New("uncommitted changes exist")
)

// userError は内部 error をユーザ向けの構造化エラー（MessageError）へ変換する。
//
// 既知の原因（sentinel error）は翻訳済みのユーザメッセージにマッピングし、
// それ以外は汎用メッセージ「異常が発生しました」で包む。いずれの場合も元 error を
// Cause に保持するため、フロントの折りたたみデバッグ情報で技術的詳細を確認できる。
//
// API メソッドは従来の fmt.Errorf("X() error\n%+v", err) の代わりに
// `return userError(err)` を返すことでユーザフレンドリーなエラーになる。
// 原因が明確な箇所は上の switch にケースを足して段階的に改善していく。
func userError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, binder.ErrNoteHasChildren):
		return Wrap(err, settings.T("go.error.noteHasChildren"))
	case errors.Is(err, binder.ErrIndexNoteUndeletable):
		return Wrap(err, settings.T("go.error.indexNoteUndeletable"))
	case errors.Is(err, binder.ErrAssetHasLayers):
		return Wrap(err, settings.T("go.error.assetHasLayers"))
	case errors.Is(err, db.DuplicateAlias):
		return Wrap(err, settings.T("go.error.duplicateAlias"))
	case errors.Is(err, fs.ErrInvalidNoteAlias):
		return Wrap(err, settings.T("go.error.invalidNoteAlias"))
	case errors.Is(err, fs.ErrInvalidAlias):
		return Wrap(err, settings.T("go.error.invalidAlias"))
	case errors.Is(err, fs.ErrReservedAlias):
		return Wrap(err, settings.T("go.error.reservedAlias"))
	case errors.Is(err, db.DuplicateKey):
		return Wrap(err, settings.T("go.error.duplicateName"))
	case errors.Is(err, convert.ErrNotBinder):
		return Wrap(err, settings.T("go.error.notBinder"))
	case errors.Is(err, fs.ErrOpenedElsewhere):
		return openedElsewhereError(err)
	case errors.Is(err, ErrUncommittedChanges):
		return Wrap(err, settings.T("go.error.uncommitted"))
	case errors.Is(err, setup.ErrKeyringUnavailable):
		return Wrap(err, settings.T("go.error.keyringUnavailable"))
	case errors.Is(err, fs.UpdatedFilesError):
		return Info(err, settings.T("go.error.noUpdates"))
	case errors.Is(err, binder.EmptyError):
		// バインダー未オープンで API が呼ばれた場合。汎用メッセージ
		//（go.error.unexpected）より状況が分かるメッセージにする
		return Wrap(err, settings.T("go.error.binderNotOpened"))
	default:
		return Wrap(err, settings.T("go.error.unexpected"))
	}
}

// openedElsewhereError は「別の Binder で開かれている」を、どのバインダーかが分かる文にする。
// 起動時に前回のバインダーを自動で開いたときは、画面にどのバインダーかが出ていないため。
// 本文にバインダーのパスを入れる。バインダー一覧（BinderHistory.jsx）もパスで並んでいるので、同じ書き方にする。
func openedElsewhereError(err error) error {
	const atKey = "go.error.openedElsewhereAt"
	var oe *fs.OpenedElsewhereError
	at := settings.T(atKey)
	// 言語ファイルが古い（~/.binder へ配り直す前）とキーがそのまま返るので、これまでの文で出す
	if !errors.As(err, &oe) || oe.Dir == "" || at == atKey {
		return Wrap(err, settings.T("go.error.openedElsewhere"))
	}
	return Wrap(err, strings.ReplaceAll(at, "{{path}}", oe.Dir))
}
