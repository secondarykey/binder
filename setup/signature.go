package setup

import (
	"binder/fs"
	"binder/settings"
)

// fs は設定（settings）を読まないので、バインダーごとの署名が無いときに使う名前とメールを
// アプリの設定から取る関数をここで渡す。
// バインダーを作る（Install）のも開く（ルートパッケージ）のも setup を import するので、
// fs で記録が行われる前に必ず設定される。
func init() {
	fs.SetDefaultUser(func() (name, email string) {
		g := settings.Get().Git
		if g == nil {
			return "", ""
		}
		return g.Name, g.Mail
	})
}
