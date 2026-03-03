package convert022

import "binder/db/convert/core"

// Convert022 は0.2.2への移行。
// このバージョンではCSVスキーマの変更はなく、
// ファイルシステム上のアセットディレクトリのフラット化のみ行う。
// ファイルシステム移行は binder.Load() 内で別途実施される。
func Convert022(p string, tables []*core.FileSet) ([]*core.FileSet, error) {
	return tables, nil
}
