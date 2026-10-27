package settings

import "slices"

// 信頼したバインダーを setting.json に保持する。
//
// プレビューはノートの HTML をアプリと同じオリジンの iframe で表示するため、
// スクリプトを動かすとアプリの機能（認証情報の読み出し・外部エディタの起動等）を呼べてしまう。
// 既定ではスクリプトを止め、ここに入っているバインダーだけ動かす。

// IsTrustedBinder は binderDir のプレビューでスクリプトを動かしてよいかを返す。
func IsTrustedBinder(binderDir string) bool {
	if binderDir == "" {
		return false
	}
	return slices.Contains(Get().TrustedBinders, binderDir)
}

// SetTrustedBinder は binderDir を信頼するかどうかを保存する。
func SetTrustedBinder(binderDir string, trusted bool) error {
	if binderDir == "" {
		return nil
	}
	obj := Get()
	has := slices.Contains(obj.TrustedBinders, binderDir)
	if has == trusted {
		return nil
	}
	if trusted {
		obj.TrustedBinders = append(obj.TrustedBinders, binderDir)
	} else {
		obj.TrustedBinders = slices.DeleteFunc(obj.TrustedBinders, func(d string) bool { return d == binderDir })
	}
	return obj.save()
}
