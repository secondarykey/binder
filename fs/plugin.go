package fs

import (
	"binder/log"
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

func (sys *FileSystem) ReadPlugins(engine string) ([]PluginInfo, error) {

	dir := PluginEngineDir(engine)

	if _, err := sys.fs.Stat(dir); err != nil {
		log.Info("plugins directory not found: %s", dir)
		return []PluginInfo{}, nil
	}

	entries, err := sys.ReadDir(dir)
	if err != nil {
		return nil, xerrors.Errorf("ReadDir(%s) error: %w", dir, err)
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
		fn := filepath.Join(dir, e.Name())
		if err := sys.readFile(&buf, fn); err != nil {
			log.Warn("plugin read error %s: %+v", e.Name(), err)
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".js")
		log.Info("plugin loaded: %s/%s", engine, name)
		plugins = append(plugins, PluginInfo{
			Name:    name,
			Content: buf.String(),
		})
	}

	log.Info("plugins found: %d (%s)", len(plugins), engine)
	return plugins, nil
}
