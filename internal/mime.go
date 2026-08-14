package internal

import (
	"mime"
	"strings"
)

// MediaType はMIMEからパラメータ（"; charset=utf-8" 等）を除いたメディアタイプを返す。
//
// **判定専用**。"text/html; charset=utf-8" はMIMEとして正しい値なので、
// 保存されている値をこれで置き換えてはならない（charset は捨ててよい情報ではない）。
// 「HTMLかどうか」のような判定を単純な文字列一致で書くとパラメータ付きで外れるため、
// 比較する側が必ずここを通してメディアタイプ同士で比べる。
func MediaType(m string) string {
	mt, _, err := mime.ParseMediaType(m)
	if err != nil {
		// パースできない値でも、"/" より前の形だけは判定に使えることがある
		if i := strings.IndexByte(m, ';'); i >= 0 {
			m = m[:i]
		}
		return strings.ToLower(strings.TrimSpace(m))
	}
	return mt
}

// SanitizeMime は保存前のMIMEを検証する。
// 妥当な値は **原文のまま返す**（パラメータも含めて保持する）。
//
//   - RFC のメディアタイプとしてパースできる      → 原文をそのまま返す
//   - メディアタイプは妥当だがパラメータが壊れている → メディアタイプ部分だけ残す
//   - メディアタイプとして成立しない              → 空文字を返す（呼び出し側で自動判定にフォールバックする）
func SanitizeMime(m string) string {
	m = strings.TrimSpace(m)
	if m == "" {
		return ""
	}

	base := m
	if i := strings.IndexByte(base, ';'); i >= 0 {
		base = strings.TrimSpace(base[:i])
	}
	// mime.ParseMediaType は "html" のような type/subtype でない値も通してしまうため、
	// メディアタイプの形（type/subtype）は自前で確認する
	if t, sub, ok := strings.Cut(base, "/"); !ok || t == "" || sub == "" {
		return ""
	}
	if _, _, err := mime.ParseMediaType(base); err != nil {
		return ""
	}

	// パラメータまで含めて妥当なら原文をそのまま採用し、
	// パラメータだけが壊れている場合はメディアタイプを残す
	if _, _, err := mime.ParseMediaType(m); err != nil {
		return base
	}
	return m
}
