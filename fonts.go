package binder

import "binder/settings"

// FontNames はシステムにインストールされたフォント名の一覧を返す。
// 実装は settings パッケージに移動済み。
func FontNames() []string {
	return settings.FontNames()
}
