package setup

import "golang.org/x/xerrors"

// このパッケージは
// 起動時にアプリ設定が存在するか？や移行処理が
// 必要かの有無を判定ものです。
func EnsureExists(ver *Version) error {

	//setting.json

	//snippets.json

	//TODO 将来
	//locales
	//theme

	//暗号化キーが存在しない場合
	if !isExistUserKey() {
		err := createUserKey()
		if err != nil {
			return xerrors.Errorf("createUserKey() error: %w", err)
		}
	}
	return nil
}
