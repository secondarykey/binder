package fs

import (
	"strings"

	"golang.org/x/xerrors"
)

func (f *FileSystem) AddDBFiles(files []string) error {

	gp := convertPaths(files...)

	rp := make([]string, len(gp))
	for i, p := range gp {
		idx := strings.LastIndex(p, DBDir)
		rp[i] = p[idx:]
	}

	err := f.add(rp...)
	if err != nil {
		return xerrors.Errorf("fs.add() error: %w", err)
	}
	return nil
}
