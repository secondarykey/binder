package convert010

import (
	"binder/db/convert/core"
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

func Convert010(p string, tables []*core.FileSet) ([]*core.FileSet, error) {

	var rtn []*core.FileSet
	var err error
	for _, f := range tables {
		nf := f
		if f.This("assets.csv") {
			nf, err = toAssets(p, f)
			if err != nil {
				return nil, xerrors.Errorf("toAssets() error: %w", err)
			}
		}
		rtn = append(rtn, nf)
	}

	return rtn, nil
}

const schemaOAsset = "id,parent_id,alias,name,detail,created_date,created_user,updated_date,updated_user"
const schemaNAsset = "id,parent_id,alias,name,detail,binary,created_date,created_user,updated_date,updated_user"

func toAssets(p string, fs *core.FileSet) (*core.FileSet, error) {

	of := filepath.Join(p, fs.Dst)

	nn := "assets010.csv"
	nf := filepath.Join(p, nn)

	//ファイルを開いてデータを変更
	fp, err := os.Open(of)
	if err != nil {
		return nil, xerrors.Errorf("os.Open() error: %w", err)
	}
	defer fp.Close()

	np, err := os.Create(nf)
	if err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}
	defer np.Close()

	scanner := bufio.NewScanner(fp)
	first := true
	for scanner.Scan() {
		line := scanner.Text()
		if first {
			_, err = np.Write([]byte(schemaNAsset + "\n"))
			if err != nil {
				return nil, xerrors.Errorf("fp.Write() error: %w", err)
			}
			first = false
		} else {
			csv := strings.Split(line, ",")
			newLine := make([]string, len(csv)+1)
			for idx, clm := range csv {
				if idx >= 5 {
					if idx == 5 {
						//binary
						newLine[idx] = "true"
					}
					newLine[idx+1] = clm
				} else if idx < 5 {
					newLine[idx] = clm
				}
			}

			_, err = np.Write([]byte(strings.Join(newLine, ",") + "\n"))
			if err != nil {
				return nil, xerrors.Errorf("fp.Write() error: %w", err)
			}
			first = false
		}
	}

	if err = scanner.Err(); err != nil {
		return nil, xerrors.Errorf("os.Create() error: %w", err)
	}

	//元ファイルで作成
	nfs := core.NewFileSet(fs.Org)
	nfs.Dst = nn

	return nfs, nil
}
