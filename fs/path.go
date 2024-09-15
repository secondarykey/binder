package fs

import (
	"binder/db/model"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
)

func ConvertPath(p string) string {
	return strings.ReplaceAll(p, "\\", "/")
}

// TODO changed ...
var publishDir = "docs"

func SetPublishDirectory(dir string) {
	publishDir = dir
}

// Binder File System(dir)

// public
// - docs/
//   index.html
//   meta
//   - pages/
//     {note_alias}.html
//   - images/
//     {diagram_alias}.svg
//   - assets/
//     {note_alias}/meta
//     {note_alias}/{assets_alias}
//

const pagesDir = "pages"

func HTMLFile(note *model.Note) string {
	if note == nil {
		return "error"
	}
	if note.Id == "index" {
		return filepath.Join(publishDir, "index.html")
	}
	a := note.Alias
	return htmlFile(a)
}

func htmlFile(a string) string {
	return filepath.Join(publishDir, pagesDir, fmt.Sprintf("%s.html", a))
}

const resourceDir = "images"

func SVGFile(diagram *model.Diagram) string {
	return svgFile(diagram.Alias)
}

func svgFile(s string) string {
	return resourceFile(s, "svg")
}

func resourceFile(s string, ext string) string {
	return filepath.Join(publishDir, resourceDir, fmt.Sprintf("%s.%s", s, ext))
}

const publicAssetsDir = "assets"

func PublicMetaFile(n *model.Note) string {
	if n == nil {
		return "error"
	}
	return publicAssetFile(n.Alias, "meta")
}

func PublicAssetFile(a *model.Asset) string {
	if a.Parent == nil {
		return ""
	}
	return publicAssetFile(a.Parent.Alias, a.Alias)
}

func publicAssetFile(p string, a string) string {
	return filepath.Join(publishDir, publicAssetsDir, p, a)
}

// private
//   - notes/
//     {note_id}.md
//   - diagrams/
//     {diagram_id}.md
//   - templates/
//     {template_id}.tmpl
//   - assets/
//      {note_id}/meta
//      {note_id}/{assets_id}

func NoteFile(id string) string {
	return noteFile(id)
}

const noteDir = "notes"

func noteFile(id string) string {
	return filepath.Join(noteDir, fmt.Sprintf("%s.md", id))
}

func DiagramFile(id string) string {
	return diagramFile(id)
}

const diagramDir = "diagrams"

func diagramFile(id string) string {
	return filepath.Join(diagramDir, fmt.Sprintf("%s.md", id))
}

const assetsDir = "assets"

func MetaFile(n *model.Note) string {
	return assetFile(n.Id, "meta")
}

func AssetFile(a *model.Asset) string {
	if a.Parent == nil {
		slog.Warn("asset parent data is nil.")
		return ""
	}
	n := a.Parent
	return assetFile(n.Id, a.Id)
}

func assetFile(p string, id string) string {
	return filepath.Join(assetsDir, p, id)
}

const templateDir = "templates"

func TemplateFile(id string) string {
	return templateFile(id)
}

func templateFile(id string) string {
	return filepath.Join(templateDir, fmt.Sprintf("%s.tmpl", id))
}
