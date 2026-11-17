package api

import (
	"binder/api/json"
	"binder/log"
)

func (a *App) GetStructure(id string) (*json.Structure, error) {
	defer log.PrintTrace(log.Func("GetStructure()"))
	s, err := a.current.GetStructure(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return s.To(), nil
}

// HasChildren は id の下に何かがあるかを返す（ノートの削除で「階層データの削除」を出すかに使う）。
func (a *App) HasChildren(id string) (bool, error) {
	defer log.PrintTrace(log.Func("HasChildren()"))
	has, err := a.current.HasChildren(id)
	if err != nil {
		log.PrintStackTrace(err)
		return false, userError(err)
	}
	return has, nil
}

// ResolveBinderLink はプレビュー内のバインダー内リンク（/pages/x.html 等）から
// 対応するエントリを解決する。
// エンティティURLでないパス、または未登録のエイリアスの場合は nil を返す（エラーにしない）。
func (a *App) ResolveBinderLink(path string) (*json.Structure, error) {
	defer log.PrintTrace(log.Func("ResolveBinderLink()"))

	if a.current == nil {
		return nil, nil
	}

	s, err := a.current.ResolveLinkPath(path)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	if s == nil {
		return nil, nil
	}
	return s.To(), nil
}
