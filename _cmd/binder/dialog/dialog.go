// Package dialog はネイティブのファイルダイアログの結果を揃える。
//
// Wails v3.0.0 では、ダイアログを取り消したときの戻り値が OS で違う。
// Windows だけ ("", error) で、エラーの文言は "cancelled by user"。macOS・Linux は ("", nil)。
// 取り消しはエラーではないので、ここで ("", nil) に揃える。ダイアログの結果は必ずこれを通す。
//
// 取り消し以外のエラー（ダイアログが開けなかった等）はそのまま返す。
// 「結果が空ならエラーを捨てる」と、本当のエラーも取り消しと同じく黙って消えてしまう。
//
// Lite（_cmd/lite/dialog）にも同じものがある。直すときは両方を直す。
package dialog

// cancelledMsg は Windows でダイアログを取り消したときのエラーの文言
// （wails の internal/go-common-file-dialog/cfd.ErrorCancelled）。
// internal なので import できず、errors.Is で見分けられない。
// Wails を上げたら、Windows で 1 回取り消して文言が変わっていないかを確かめる。
const cancelledMsg = "cancelled by user"

// IsCancelled は err がダイアログの取り消しかを返す。
func IsCancelled(err error) bool {
	return err != nil && err.Error() == cancelledMsg
}

// Path は単一選択・保存ダイアログの結果を「取り消し = 空文字・nil」に揃える。
func Path(path string, err error) (string, error) {
	if IsCancelled(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return path, nil
}
