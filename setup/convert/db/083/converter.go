package convert083

import (
	"binder/setup/convert/db/core"
	"bufio"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Convert083 は0.8.3への移行。
// assets.csv に mime 列を追加する。
// structures.csv の name（ファイル名）から拡張子を取得し、MIMEタイプを判定して設定する。
func Convert083(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	// structures.csv から asset の id → name マッピングを構築
	nameMap, err := buildAssetNameMap(p, tables)
	if err != nil {
		return nil, xerrors.Errorf("buildAssetNameMap() error: %w", err)
	}

	var rtn []*core.FileSet
	for _, f := range tables {
		nf := f
		if f.This("assets.csv") {
			nf2, err := addMimeToAssets(p, f, nameMap)
			if err != nil {
				return nil, xerrors.Errorf("addMimeToAssets() error: %w", err)
			}
			nf = nf2
		}
		rtn = append(rtn, nf)
	}

	return rtn, nil
}

// buildAssetNameMap は structures.csv を読み取り、type=asset のエントリの id → name マッピングを返す。
func buildAssetNameMap(p string, tables []*core.FileSet) (map[string]string, error) {

	// structures.csv の FileSet を探す
	var structFile string
	for _, f := range tables {
		if f.This("structures.csv") {
			structFile = filepath.Join(p, f.Dst)
			break
		}
	}
	if structFile == "" {
		// structures.csv がない場合は空マップ（古いスキーマ）
		return map[string]string{}, nil
	}

	fp, err := os.Open(structFile)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		return map[string]string{}, nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// 列インデックスを特定
	idIdx := -1
	typeIdx := -1
	nameIdx := -1
	for i, c := range cols {
		switch c {
		case "id":
			idIdx = i
		case "type":
			typeIdx = i
		case "name":
			nameIdx = i
		}
	}
	if idIdx < 0 || typeIdx < 0 || nameIdx < 0 {
		return map[string]string{}, nil
	}

	nameMap := make(map[string]string)
	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")
		if len(row) <= typeIdx || len(row) <= nameIdx || len(row) <= idIdx {
			continue
		}
		if row[typeIdx] == "asset" {
			nameMap[row[idIdx]] = row[nameIdx]
		}
	}

	return nameMap, nil
}

// detectMimeByName はファイル名の拡張子からMIMEタイプを判定する。
func detectMimeByName(name string, binary bool) string {
	ext := filepath.Ext(name)
	if ext != "" {
		m := mime.TypeByExtension(ext)
		if m != "" {
			return m
		}
	}
	if binary {
		return "application/octet-stream"
	}
	return "text/plain"
}

// addMimeToAssets は assets.csv に mime 列を追加する。
func addMimeToAssets(p string, fs *core.FileSet, nameMap map[string]string) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	if !scanner.Scan() {
		return fs, nil
	}
	headerLine := scanner.Text()
	cols := strings.Split(headerLine, ",")

	// 既に mime 列が存在する場合はスキップ
	for _, c := range cols {
		if c == "mime" {
			return fs, nil
		}
	}

	// id 列と binary 列のインデックスを特定
	idIdx := -1
	binaryIdx := -1
	for i, c := range cols {
		switch c {
		case "id":
			idIdx = i
		case "binary":
			binaryIdx = i
		}
	}

	// binary 列の直後に mime を挿入
	insertIdx := binaryIdx + 1
	newHeader := make([]string, 0, len(cols)+1)
	newHeader = append(newHeader, cols[:insertIdx]...)
	newHeader = append(newHeader, "mime")
	newHeader = append(newHeader, cols[insertIdx:]...)

	nn := "assets083.csv"
	nf := filepath.Join(p, nn)
	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	_, err = np.Write([]byte(strings.Join(newHeader, ",") + "\n"))
	if err != nil {
		return nil, xerrors.Errorf("np.Write(header) error: %w", err)
	}

	for scanner.Scan() {
		row := strings.Split(scanner.Text(), ",")

		// binary フラグを取得
		binary := false
		if binaryIdx >= 0 && binaryIdx < len(row) {
			binary = (row[binaryIdx] == "true")
		}

		// 名前からMIMEを判定
		mimeType := "application/octet-stream"
		if idIdx >= 0 && idIdx < len(row) {
			name, ok := nameMap[row[idIdx]]
			if ok && name != "" {
				mimeType = detectMimeByName(name, binary)
			} else if !binary {
				mimeType = "text/plain"
			}
		}

		newRow := make([]string, 0, len(row)+1)
		newRow = append(newRow, row[:insertIdx]...)
		newRow = append(newRow, mimeType)
		newRow = append(newRow, row[insertIdx:]...)

		_, err = np.Write([]byte(strings.Join(newRow, ",") + "\n"))
		if err != nil {
			return nil, xerrors.Errorf("np.Write(row) error: %w", err)
		}
	}

	if err = scanner.Err(); err != nil {
		return nil, xerrors.Errorf("scanner error: %w", err)
	}

	nfs := core.NewFileSet(fs.Org)
	nfs.Dst = nn
	return nfs, nil
}
