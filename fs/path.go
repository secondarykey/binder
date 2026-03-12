package fs

import (
	"binder/api/json"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
)

func (sys *FileSystem) ToFullPath(mode, id string) string {
	fn := ""
	switch mode {
	case "note":
		fn = noteFile(id)
	case "diagram":
		fn = diagramFile(id)
	case "template":
		slog.Warn("Not Implemented")
	case "assets":
		slog.Warn("Not Implemented")
	default:
	}

	rp := sys.base
	return filepath.Join(rp, fn)
}

// GitBash用のパス変換
func ToGitBash(p string) string {
	// "C:\test" to /C/test
	cp := convertPaths(p)
	//C:/test
	ccp := strings.Replace(cp[0], ":", "", 1)
	//C/test
	return "/" + ccp
}

func convertPath(path string) string {
	rtn := convertPaths(path)
	return rtn[0]
}

func ConvertHTTPPath(path string) string {
	rtn := convertPaths(path)
	return rtn[0]
}

func ConvertPaths(paths ...string) []string {
	return convertPaths(paths...)
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

func HTMLFile(note *json.Note) string {
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

func SVGFile(diagram *json.Diagram) string {
	return svgFile(diagram.Alias)
}

func svgFile(s string) string {
	return resourceFile(s, "svg")
}

func resourceFile(s string, ext string) string {
	return filepath.Join(publishDir, resourceDir, fmt.Sprintf("%s.%s", s, ext))
}

const publicAssetsDir = "assets"

func PublicMetaFile(n *json.Note) string {
	if n == nil {
		return "error"
	}
	return publicAssetFile(n.Alias + "-meta")
}

func PublicAssetFile(a *json.Asset) string {
	if a.Alias == "" {
		return ""
	}
	return publicAssetFile(a.Alias)
}

func publicAssetFile(alias string) string {
	return filepath.Join(publishDir, publicAssetsDir, alias)
}

// private
//   - notes/
//     {note_id}.md
//   - diagrams/
//     {diagram_id}.md
//   - templates/
//     {template_id}.tmpl
//   - assets/
//      meta/
//        {note_id}
//      {assets_id}

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
const MetaSubDir = "meta"

func MetaFile(n *json.Note) string {
	return filepath.Join(AssetDir, MetaSubDir, n.Id)
}

func AssetFile(a *json.Asset) string {
	if a.Id == "" {
		return ""
	}
	return assetFile(a.Id)
}

func assetFile(id string) string {
	return filepath.Join(AssetDir, id)
}

const TemplateDir = "templates"

func TemplateFile(id string) string {
	return templateFile(id)
}

func templateFile(id string) string {
	return filepath.Join(TemplateDir, fmt.Sprintf("%s.tmpl", id))
}

const DBDir = "db"
