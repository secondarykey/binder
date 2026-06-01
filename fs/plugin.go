package fs

import (
	"bytes"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/xerrors"
)

type PluginInfo struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (sys *FileSystem) ReadPlugins() ([]PluginInfo, error) {

	if _, err := sys.fs.Stat(PluginDir); err != nil {
		return []PluginInfo{}, nil
	}

	entries, err := sys.ReadDir(PluginDir)
	if err != nil {
		return nil, xerrors.Errorf("ReadDir(%s) error: %w", PluginDir, err)
	}

	var jsFiles []fs.DirEntry
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".js") {
			continue
		}
		jsFiles = append(jsFiles, e)
	}

	sort.Slice(jsFiles, func(i, j int) bool {
		return jsFiles[i].Name() < jsFiles[j].Name()
	})

	plugins := make([]PluginInfo, 0, len(jsFiles))
	for _, e := range jsFiles {
		var buf bytes.Buffer
		fn := filepath.Join(PluginDir, e.Name())
		if err := sys.readFile(&buf, fn); err != nil {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".js")
		plugins = append(plugins, PluginInfo{
			Name:    name,
			Content: buf.String(),
		})
	}

	return plugins, nil
}
