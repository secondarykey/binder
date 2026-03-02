package binder

import (
	"binder/api/json"
	"binder/db/model"

	"log/slog"

	"golang.org/x/xerrors"
)

func (b *Binder) GetBinderTree() (*json.Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	// Structureテーブルのみで全ツリーを構築
	structures, err := b.db.FindStructures()
	if err != nil {
		return nil, xerrors.Errorf("db.FindStructures() error: %w", err)
	}

	slog.Info("Tree Length", "Structures", len(structures))

	treeMap := make(map[string][]*json.Leaf)
	for _, s := range structures {
		slog.Debug("GetTree()", "Structure", s)
		list := treeMap[s.ParentId]
		treeMap[s.ParentId] = append(list, convertStructure2Leaf(s))
	}

	root := treeMap[""]
	visited := make(map[string]bool)
	var buildTree func(nodes []*json.Leaf)
	buildTree = func(nodes []*json.Leaf) {
		for _, node := range nodes {
			if node.Id == "" || visited[node.Id] {
				continue
			}
			visited[node.Id] = true
			node.Children = treeMap[node.Id]
			buildTree(node.Children)
		}
	}
	buildTree(root)

	slog.Info("Tree", "RootLength", len(root))
	if root != nil {
		slog.Info("Tree", "RootId", root[0].Id)
		slog.Info("Tree", "Root Children", len(root[0].Children))
	}

	var tree json.Tree
	tree.Data = root

	return &tree, nil
}

func convertStructure2Leaf(s *model.Structure) *json.Leaf {
	var l json.Leaf
	l.Id = s.Id
	l.ParentId = s.ParentId
	l.Seq = s.Seq
	l.Name = s.Name
	l.Type = s.Typ
	return &l
}

func (b *Binder) GetTemplateTree() (*json.Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	htmlLeaf := json.NewLeaf("DIR_HTML", "HTML")

	tempMap := make(map[json.TemplateType]*json.Leaf)
	tempMap[json.LayoutTemplateType] = json.NewLeaf("DIR_HTML_Layout", "Layout")
	tempMap[json.ContentTemplateType] = json.NewLeaf("DIR_HTML_Content", "Content")
	tempMap[json.NoteTemplateType] = json.NewLeaf("DIR_Note", "Note")
	tempMap[json.DiagramTemplateType] = json.NewLeaf("DIR_Diagram", "Diagram")
	tempMap[json.TemplateTemplateType] = json.NewLeaf("DIR_Template", "Template")

	//大枠のツリーを作成
	root := make([]*json.Leaf, 4)
	root[0] = htmlLeaf
	root[1] = tempMap[json.NoteTemplateType]
	root[2] = tempMap[json.DiagramTemplateType]
	root[3] = tempMap[json.TemplateTemplateType]

	htmlLeaf.AddChild(tempMap[json.LayoutTemplateType])
	htmlLeaf.AddChild(tempMap[json.ContentTemplateType])

	templates, err := b.db.FindTemplates()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	for _, temp := range templates {
		t := json.TemplateType(temp.Typ)
		current := tempMap[t]
		current.AddChild(convertTemplateLeaf(temp))
	}

	var tree json.Tree
	tree.Data = root

	return &tree, nil
}

func convertTemplateLeaf(d *model.Template) *json.Leaf {
	var l json.Leaf
	l.Id = d.Id
	l.Name = d.Name
	l.Type = string(d.Typ)
	return &l
}

func (b *Binder) GetModifiedTree() (*json.Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	var tree json.Tree

	//全データを検索する
	files, err := b.fileSystem.Status()
	if err != nil {
		return nil, xerrors.Errorf("fs.Status() error: %w", err)
	}

	dirNote := json.NewLeaf("DIR_Note", "note")
	tree.Data = append(tree.Data, dirNote)
	wk := files.Notes()
	if wk.Exists() {
		ids := wk.Ids()
		structures, err := b.db.FindInStructureId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInStructureId() error: %w", err)
		}
		for _, s := range structures {
			if s.Typ == "note" {
				dirNote.AddChild(convertStructure2Leaf(s))
			}
		}
	}

	dirDiagram := json.NewLeaf("DIR_Diagram", "diagram")
	tree.Data = append(tree.Data, dirDiagram)
	wk = files.Diagrams()
	if wk.Exists() {
		ids := wk.Ids()
		structures, err := b.db.FindInStructureId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInStructureId() error: %w", err)
		}
		for _, s := range structures {
			if s.Typ == "diagram" {
				dirDiagram.AddChild(convertStructure2Leaf(s))
			}
		}
	}

	dirAsset := json.NewLeaf("DIR_Asset", "asset")
	tree.Data = append(tree.Data, dirAsset)
	wk = files.Assets()
	if wk.Exists() {
		ids := wk.Ids()
		structures, err := b.db.FindInStructureId(ids...)
		if err != nil {
			return nil, xerrors.Errorf("db.FindInStructureId() error: %w", err)
		}
		for _, s := range structures {
			if s.Typ == "asset" {
				dirAsset.AddChild(convertStructure2Leaf(s))
			}
		}
	}

	dirTemplate := json.NewLeaf("DIR_Template", "template")
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
			l := json.NewLeaf(t.Id, t.Name)
			l.Type = "template"
			dirTemplate.AddChild(l)
		}
	}

	return &tree, nil
}

func (b *Binder) GetUnpublishedTree() (*json.Tree, error) {

	if b == nil {
		return nil, EmptyError
	}

	var tree json.Tree

	dirNote := json.NewLeaf("DIR_Note", "note")
	tree.Data = append(tree.Data, dirNote)
	notes, err := b.GetUnpublishedNotes()
	if err != nil {
		return nil, xerrors.Errorf("UnpublishNotes() error: %w", err)
	}

	for _, n := range notes {
		l := &json.Leaf{Id: n.Id, ParentId: n.ParentId, Name: n.Name, Type: "note"}
		dirNote.AddChild(l)
	}

	dirDiagram := json.NewLeaf("DIR_Diagram", "diagram")
	tree.Data = append(tree.Data, dirDiagram)
	diagrams, err := b.GetUnpublishedDiagrams()
	if err != nil {
		return nil, xerrors.Errorf("UnpublishDiagrams() error: %w", err)
	}
	for _, d := range diagrams {
		l := &json.Leaf{Id: d.Id, ParentId: d.ParentId, Name: d.Name, Type: "diagram"}
		dirDiagram.AddChild(l)
	}

	dirAsset := json.NewLeaf("DIR_Asset", "asset")

	tree.Data = append(tree.Data, dirAsset)
	assets, err := b.GetUnpublishedAssets()
	if err != nil {
		return nil, xerrors.Errorf("UnpublishAssets() error: %w", err)
	}
	for _, a := range assets {
		l := &json.Leaf{Id: a.Id, ParentId: a.ParentId, Name: a.Name, Type: "asset"}
		dirAsset.AddChild(l)
	}

	return &tree, nil
}
