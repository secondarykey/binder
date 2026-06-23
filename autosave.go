package binder

import (
	"errors"

	"binder/fs"

	"golang.org/x/xerrors"
)

// autoSaveDirLabels は GetModifiedTree のディレクトリLeaf(ID)に対するコメント上の表示名。
// 全体コミット（ModifiedMenu.jsx）と同じ階層表示にする。
var autoSaveDirLabels = map[string]string{
	"DIR_Note":     "Note",
	"DIR_Diagram":  "Diagram",
	"DIR_Asset":    "Asset",
	"DIR_Layer":    "Layer",
	"DIR_Template": "Template",
	"DIR_File":     "File",
}

// AutoSave は変更のある全エンティティを一括コミットする（自動保存）。
// コミットメッセージは "Auto Save" を接頭子とし、後続は全体コミットと同じ階層表示
// （Updated: 配下に Note/Diagram/... ごとの名称一覧）にする。
// コミットしたファイル数を返す。変更がない場合は 0 を返す（エラーにしない）。
func (b *Binder) AutoSave() (int, error) {
	if b == nil {
		return 0, EmptyError
	}

	tree, err := b.GetModifiedTree()
	if err != nil {
		return 0, xerrors.Errorf("GetModifiedTree() error: %w", err)
	}

	var files []string
	comment := "Auto Save\nUpdated:"
	for _, dir := range tree.Data {
		if len(dir.Children) == 0 {
			continue
		}
		label, ok := autoSaveDirLabels[dir.Id]
		if !ok {
			label = dir.Id
		}
		comment += "\n  " + label + ":"
		for _, c := range dir.Children {
			comment += "\n    " + c.Name
			files = append(files, b.ToFile(c.Type, c.Id))
		}
	}

	// 変更なし
	if len(files) == 0 {
		return 0, nil
	}

	err = b.CommitFiles(comment, files...)
	if err != nil {
		// 直前に他経路でコミット済み等で実変更がない場合は保存件数0として扱う
		if errors.Is(err, fs.UpdatedFilesError) {
			return 0, nil
		}
		return 0, xerrors.Errorf("CommitFiles() error: %w", err)
	}

	return len(files), nil
}
