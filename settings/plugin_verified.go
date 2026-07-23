package settings

import "strings"

// プラグインの「検証時 marked メジャー」を setting.json に保持する。
//
// @marked 未宣言のプラグインについて、「いつの marked で追加・更新したか」を記録し、
// 現在の marked と食い違う場合に「動作未確認」と警告するために使う。
// バインダーのディレクトリパスでスコープするため、複数バインダーで同名プラグインが
// あっても衝突しない。git 管理外のローカル観測値。

func pluginVerifiedKey(engine, name string) string {
	return engine + "/" + name
}

// GetPluginVerified は指定バインダー・エンジンの { プラグイン名: marked メジャー } を返す。
func GetPluginVerified(binderDir, engine string) map[string]int {
	obj := Get()
	out := map[string]int{}
	m := obj.PluginVerified[binderDir]
	if m == nil {
		return out
	}
	prefix := engine + "/"
	for k, v := range m {
		if strings.HasPrefix(k, prefix) {
			out[strings.TrimPrefix(k, prefix)] = v
		}
	}
	return out
}

// SetPluginVerified はプラグインの検証時メジャーを記録する。
func SetPluginVerified(binderDir, engine, name string, major int) error {
	obj := Get()
	if obj.PluginVerified == nil {
		obj.PluginVerified = map[string]map[string]int{}
	}
	if obj.PluginVerified[binderDir] == nil {
		obj.PluginVerified[binderDir] = map[string]int{}
	}
	obj.PluginVerified[binderDir][pluginVerifiedKey(engine, name)] = major
	return obj.save()
}

// DeletePluginVerified はプラグインの検証時メジャー記録を削除する。
func DeletePluginVerified(binderDir, engine, name string) error {
	obj := Get()
	m := obj.PluginVerified[binderDir]
	if m == nil {
		return nil
	}
	delete(m, pluginVerifiedKey(engine, name))
	return obj.save()
}

// RenamePluginVerified はリネームに追随して記録を移す。
func RenamePluginVerified(binderDir, engine, oldName, newName string) error {
	obj := Get()
	m := obj.PluginVerified[binderDir]
	if m == nil {
		return nil
	}
	oldKey := pluginVerifiedKey(engine, oldName)
	v, ok := m[oldKey]
	if !ok {
		return nil
	}
	m[pluginVerifiedKey(engine, newName)] = v
	delete(m, oldKey)
	return obj.save()
}
