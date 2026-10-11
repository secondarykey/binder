package settings

import (
	"errors"
	"os"
	"path/filepath"
	"sort"

	"binder/log"

	"github.com/flopp/go-findfont"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/xerrors"
)

// FontNames はシステムにインストールされたフォント名の一覧を返す。
func FontNames() []string {

	paths := findfont.List()
	families := make(map[string]string)

	var names []string

	for _, p := range paths {
		n, err := getFontNames(p)
		if n != nil {
			for _, name := range n {
				_, ok := families[name]
				if !ok {
					families[name] = name
					names = append(names, name)
				}
			}
		}
		if err != nil {
			b := filepath.Base(p)
			log.Warn("Font Name error:%s\n%+v", b, err)
		}
	}

	sort.Slice(names, func(i, j int) bool {
		return names[i] < names[j]
	})

	return names
}

func getFontNames(p string) ([]string, error) {

	var names []string

	b, err := os.ReadFile(p)
	if err != nil {
		return nil, xerrors.Errorf("os.ReadFile() error: %w", err)
	}

	fonts, err := opentype.ParseCollection(b)
	if err != nil {
		return nil, xerrors.Errorf("opentype.ParseCollection() error: %w", err)
	}

	var rtnE error
	for idx := 0; idx < fonts.NumFonts(); idx++ {
		fnt, err := fonts.Font(idx)
		if err != nil {
			errors.Join(rtnE, err)
			continue
		}

		name, err := fnt.Name(nil, sfnt.NameIDFamily)
		if err != nil {
			errors.Join(rtnE, err)
			continue
		}
		names = append(names, name)
	}

	return names, err
}
