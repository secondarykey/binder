package setup

import (
	"io/fs"
	"path"
	"sort"
	"strings"

	"golang.org/x/xerrors"
)

// ルートファイルの雛形（AGENTS.md 等）。
//
// バインダーへ自動では置かない。バインダー設定の「ファイル」タブで、
// ユーザが雛形を選んだときだけルートファイルとして書き出す（記録は未記録一覧から）。
// 雛形は言語ごとに _assets/rootfiles/{lang}/ に置き、無い言語は英語にする。
const (
	rootFileTemplateDir  = "_assets/rootfiles"
	rootFileTemplateLang = "en"
)

// ErrNoRootFileTemplate は指定した名前の雛形が無いときのエラー。
var ErrNoRootFileTemplate = xerrors.New("root file template not found")

// RootFileTemplates は雛形の名前の一覧を返す（英語の雛形を基準にする）。
func RootFileTemplates() ([]string, error) {
	entries, err := fs.ReadDir(embFs, path.Join(rootFileTemplateDir, rootFileTemplateLang))
	if err != nil {
		return nil, xerrors.Errorf("fs.ReadDir() error: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names, nil
}

// RootFileTemplate は雛形の中身を返す。lang の雛形が無ければ英語の雛形を返す。
// 改行は LF にそろえる（埋め込むファイルの改行はチェックアウトの設定で変わるため）。
func RootFileTemplate(name, lang string) (string, error) {
	if name == "" || strings.ContainsAny(name, `/\`) {
		return "", xerrors.Errorf("%w: %s", ErrNoRootFileTemplate, name)
	}
	for _, l := range []string{lang, rootFileTemplateLang} {
		if l == "" || strings.ContainsAny(l, `/\.`) {
			continue
		}
		buf, err := fs.ReadFile(embFs, path.Join(rootFileTemplateDir, l, name))
		if err == nil {
			return strings.ReplaceAll(string(buf), "\r\n", "\n"), nil
		}
	}
	return "", xerrors.Errorf("%w: %s", ErrNoRootFileTemplate, name)
}
