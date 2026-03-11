package convert045

import (
	"binder/db/convert/core"
)

// Convert045 は0.4.5への移行。
// config.csvを廃止し、binder.jsonで管理するためファイルセットから除外する。
// name/detailの値はLoad()がconvert.Run()呼び出し前にreadConfigCSV()で読み込み済み。
func Convert045(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet

	for _, f := range tables {
		if f.This("config.csv") {
			// config.csvを除外（binder.jsonに移行済み）
			continue
		}
		rtn = append(rtn, f)
	}

	return rtn, nil
}
