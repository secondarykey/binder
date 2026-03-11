package convert

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// readConfigCSV はdb/config.csvからnameとdetailを読み込む（0.4.5移行用）。
// ファイルが存在しない場合やパースできない場合はデフォルト値を返す。
func readConfigCSV(dbDir string) (name, detail string) {
	p := filepath.Join(dbDir, "config.csv")
	fp, err := os.Open(p)
	if err != nil {
		return "Binder", ""
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)

	// ヘッダ行を読み込んでname/detailのインデックスを特定
	if !scanner.Scan() {
		return "Binder", ""
	}
	headers := strings.Split(scanner.Text(), ",")
	nameIdx, detailIdx := -1, -1
	for i, h := range headers {
		switch h {
		case "name":
			nameIdx = i
		case "detail":
			detailIdx = i
		}
	}
	if nameIdx < 0 {
		return "Binder", ""
	}

	// 最初のデータ行を読み込む
	if !scanner.Scan() {
		return "Binder", ""
	}
	cols := strings.Split(scanner.Text(), ",")

	if nameIdx < len(cols) {
		name = unescapeCSVField(cols[nameIdx])
	}
	if detailIdx >= 0 && detailIdx < len(cols) {
		detail = unescapeCSVField(cols[detailIdx])
	}

	if name == "" {
		name = "Binder"
	}
	return name, detail
}

// unescapeCSVField はcsvqのエスケープを元に戻す
func unescapeCSVField(s string) string {
	s = strings.ReplaceAll(s, "&#10;", "\n")
	s = strings.ReplaceAll(s, "&#32;", " ")
	s = strings.ReplaceAll(s, "&#34;", "\"")
	s = strings.ReplaceAll(s, "&#44;", ",")
	return s
}
