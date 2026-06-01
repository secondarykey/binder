package settings

import "path/filepath"

const PluginsDirName = "plugins"

func PluginsDirPath() string {
	return filepath.Join(DirPath(), PluginsDirName)
}

func DefaultPluginsDirPath() string {
	return filepath.Join(PluginsDirPath(), DefaultDirName)
}
