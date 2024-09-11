package binder

import (
	"binder/db/model"
	"fmt"
	"log/slog"

	"golang.org/x/xerrors"
)

type Tree struct {
	Data []*Leaf `json:"data"`
}

type Leaf struct {
	Id       string  `json:"id"`
	ParentId string  `json:"parentId"`
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Children []*Leaf `json:"children"`
}

func (l *Leaf) String() string {
	return fmt.Sprintf("%s(%s) %s", l.Name, l.Id, l.Type)
}

func (b *Binder) GetTree() (*Tree, error) {

	slog.Info("GetTree() Call")

	//TODO 多い場合の表示を考える
	notes, err := b.db.FindUpdatedNotes(-1, -1)
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	diagrams, err := b.db.FindDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}

	slog.Info("Tree Length", "Notes", len(notes), "Diagrams", len(diagrams))

	treeMap := make(map[string][]*Leaf)
	for _, n := range notes {
		slog.Debug("GetTree()", "Note", n)
		list := treeMap[n.ParentId]
		treeMap[n.ParentId] = append(list, convertNote2Leaf(n))
	}

	for _, d := range diagrams {
		slog.Debug("GetTree()", "Diagram", d)
		list := treeMap[d.ParentId]
		treeMap[d.ParentId] = append(list, convertDiagram2Leaf(d))
	}

	var root []*Leaf
	for key, children := range treeMap {
		if key == "" {
			root = children
		}
		for _, child := range children {
			wk := treeMap[child.Id]
			child.Children = wk
		}
	}

	slog.Info("Tree", "RootLength", len(root))
	if root != nil {
		slog.Info("Tree", "RootId", root[0].Id)
		slog.Info("Tree", "Root Children", len(root[0].Children))
	}

	var tree Tree
	tree.Data = root

	return &tree, nil
}

func convertNote2Leaf(n *model.Note) *Leaf {
	var l Leaf
	l.Id = n.Id
	l.ParentId = n.ParentId
	l.Name = n.Name
	l.Type = "note"
	return &l
}

func convertDiagram2Leaf(d *model.Diagram) *Leaf {
	var l Leaf
	l.Id = d.Id
	l.ParentId = d.ParentId
	l.Name = d.Name
	l.Type = "diagram"
	return &l
}
