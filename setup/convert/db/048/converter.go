package convert048

import "binder/setup/convert/db/core"

// Convert048 は0.4.8への移行。
// このバージョンではCSVスキーマの変更はなく、
// ファイルシステム上のメタファイルパス変更のみ行う。
// ファイルシステム移行は binder.Load() 内で別途実施される。
func Convert048(p string, tables []*core.FileSet) ([]*core.FileSet, error) {
	return tables, nil
}
