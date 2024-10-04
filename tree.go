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

func newLeaf(id, name string) *Leaf {
	var l Leaf
	l.Id = id
	l.Name = name
	return &l
}

func (l *Leaf) AddChild(c *Leaf) {
	l.Children = append(l.Children, c)
	c.ParentId = l.Id
}

func (l *Leaf) String() string {
	return fmt.Sprintf("%s(%s) %s", l.Name, l.Id, l.Type)
}

func (b *Binder) GetBinderTree() (*Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	//err := b.fileSystem.PrintStatus()
	//if err != nil {
	//log.PrintStackTrace(err)
	//}

	//TODO 多い場合の表示を考える
	notes, err := b.db.FindUpdatedNotes(-1, -1)
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	diagrams, err := b.db.FindDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("db.FindDiagrams() error: %w", err)
	}

	assets, err := b.db.FindAssets()
	if err != nil {
		return nil, xerrors.Errorf("db.FindAssets() error: %w", err)
	}

	slog.Info("Tree Length", "Notes", len(notes), "Diagrams", len(diagrams), "Assets", len(assets))

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

	for _, a := range assets {
		slog.Debug("GetTree()", "Asset", a)
		list := treeMap[a.ParentId]
		treeMap[a.ParentId] = append(list, convertAsset2Leaf(a))
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

func convertAsset2Leaf(a *model.Asset) *Leaf {
	var l Leaf
	l.Id = a.Id
	l.ParentId = a.ParentId
	l.Name = a.Name
	l.Type = "asset"
	return &l
}

func (b *Binder) GetTemplateTree() (*Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	htmlLeaf := newLeaf("DIR_HTML", "HTML")

	tempMap := make(map[model.TemplateType]*Leaf)
	tempMap[model.LayoutTemplateType] = newLeaf("DIR_HTML_Layout", "Layout")
	tempMap[model.ContentTemplateType] = newLeaf("DIR_HTML_Content", "Content")
	tempMap[model.NoteTemplateType] = newLeaf("DIR_Note", "Note")
	tempMap[model.DiagramTemplateType] = newLeaf("DIR_Diagram", "Diagram")
	tempMap[model.TemplateTemplateType] = newLeaf("DIR_Template", "Template")

	//大枠のツリーを作成
	root := make([]*Leaf, 4)
	root[0] = htmlLeaf
	root[1] = tempMap[model.NoteTemplateType]
	root[2] = tempMap[model.DiagramTemplateType]
	root[3] = tempMap[model.TemplateTemplateType]

	htmlLeaf.AddChild(tempMap[model.LayoutTemplateType])
	htmlLeaf.AddChild(tempMap[model.ContentTemplateType])

	templates, err := b.db.FindTemplates()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	for _, temp := range templates {
		t := model.TemplateType(temp.Typ)
		current := tempMap[t]
		current.AddChild(convertTemplateLeaf(temp))
	}

	var tree Tree
	tree.Data = root

	return &tree, nil
}

func convertTemplateLeaf(d *model.Template) *Leaf {
	var l Leaf
	l.Id = d.Id
	l.Name = d.Name
	l.Type = string(d.Typ)
	return &l
}

func (b *Binder) GetModifiedTree() (*Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	var tree Tree

	//全データを検索する
	files, err := b.fileSystem.Status()
	if err != nil {
		return nil, xerrors.Errorf("fs.Status() error: %w", err)
	}

	dirNote := newLeaf("DIR_Note", "note")
	tree.Data = append(tree.Data, dirNote)
	wk := files.Notes()
	if wk.Exists() {
		ids := wk.Ids()
		notes, err := b.db.FindInNoteId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInNoteId() error: %w", err)
		}
		for _, n := range notes {
			dirNote.AddChild(convertNote2Leaf(n))
		}
	}

	dirDiagram := newLeaf("DIR_Diagram", "diagram")
	tree.Data = append(tree.Data, dirDiagram)
	wk = files.Diagrams()
	if wk.Exists() {
		ids := wk.Ids()
		diagrams, err := b.db.FindInDiagramId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInDiagramId() error: %w", err)
		}
		for _, d := range diagrams {
			dirDiagram.AddChild(convertDiagram2Leaf(d))
		}
	}

	dirAsset := newLeaf("DIR_Asset", "asset")
	tree.Data = append(tree.Data, dirAsset)
	wk = files.Assets()
	if wk.Exists() {
		ids := wk.Ids()
		assets, err := b.db.FindInAssetId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInAssetId() error: %w", err)
		}
		for _, a := range assets {
			dirAsset.AddChild(convertAsset2Leaf(a))
		}
	}

	dirTemplate := newLeaf("DIR_Template", "template")
	tree.Data = append(tree.Data, dirTemplate)
	wk = files.Templates()
	if wk.Exists() {
		ids := wk.Ids()
		templates, err := b.db.FindInTemplateId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindIdTempalteId() error: %w", err)
		}
		for _, t := range templates {
			//テンプレートのTypeだと、テンプレートのタイプになるため注意
			l := newLeaf(t.Id, t.Name)
			l.Type = "template"
			dirTemplate.AddChild(l)
		}
	}

	return &tree, nil
}
