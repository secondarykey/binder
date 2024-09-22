package fs

import (
	"binder/db/model"
	"fmt"
	"path/filepath"
	"strings"
)

// GitBash用のパス変換
func ToGitBash(p string) string {
	// "C:\test" to /C/test
	cp := convertPaths(p)
	//C:/test
	ccp := strings.Replace(cp[0], ":", "", 1)
	//C/test
	return "/" + ccp
}

func ConvertHTTPPath(path string) string {
	rtn := convertPaths(path)
	return rtn[0]
}

func convertPaths(paths ...string) []string {
	rtn := make([]string, len(paths))
	for idx, p := range paths {
		rtn[idx] = strings.ReplaceAll(p, "\\", "/")
	}
	return rtn
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

const NoteDir = "notes"

func noteFile(id string) string {
	return filepath.Join(NoteDir, fmt.Sprintf("%s.md", id))
}

func DiagramFile(id string) string {
	return diagramFile(id)
}

const DiagramDir = "diagrams"

func diagramFile(id string) string {
	return filepath.Join(DiagramDir, fmt.Sprintf("%s.md", id))
}

const AssetDir = "assets"

func MetaFile(n *model.Note) string {
	return assetFile(n.Id, "meta")
}

func AssetFile(a *model.Asset) string {
	if a.ParentId == "" {
		return ""
	}
	return assetFile(a.ParentId, a.Id)
}

func assetFile(p string, id string) string {
	return filepath.Join(AssetDir, p, id)
}

const TemplateDir = "templates"

func TemplateFile(id string) string {
	return templateFile(id)
}

func templateFile(id string) string {
	return filepath.Join(TemplateDir, fmt.Sprintf("%s.tmpl", id))
}

const DBDir = "db"
