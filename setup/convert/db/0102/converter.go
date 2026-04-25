package convert0102

import "binder/setup/convert/db/core"

// Convert0102 は0.10.2への移行。
// このバージョンではCSVスキーマの変更はなく、
// 新規テーブル layers.csv は db.EnsureTableFiles() で作成される。
func Convert0102(p string, tables []*core.FileSet) ([]*core.FileSet, error) {
	return tables, nil
}
