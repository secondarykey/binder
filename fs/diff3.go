package fs

import (
	"strings"

	dmp "github.com/sergi/go-diff/diffmatchpatch"
)

// マージ競合のマーカー。git 互換の記号（エディタがハイライトできる）に
// このプロジェクトの方針どおり日本語ラベルを併記する。
const (
	mergeMarkerOurs   = "<<<<<<< ローカル (LOCAL)"
	mergeMarkerMiddle = "======="
	mergeMarkerTheirs = ">>>>>>> リモート (REMOTE)"
)

// diff3MaxLines は3-wayマージを行う1ファイルあたりの最大行数。
// これを超える場合は性能・安全のため全文併記にフォールバックする。
const diff3MaxLines = 20000

// mergeDiff3 は base/ours/theirs の3-wayテキストマージを行う。
// 片側のみが変更した箇所は自動採用し、双方が同じ箇所を別々に変更した
// 場合だけ競合マーカー（mergeMarker*）で囲んで両方を残す。
// 共通部分は1度だけ出力されるため、全文併記より差分が局所化されて読みやすい。
// 第2戻り値は競合が1つ以上発生したかを示す。
func mergeDiff3(base, ours, theirs string) (string, bool) {

	o := splitLines(base)
	a := splitLines(ours)
	b := splitLines(theirs)

	if len(o) > diff3MaxLines || len(a) > diff3MaxLines || len(b) > diff3MaxLines {
		return fallbackConcat(ours, theirs), true
	}

	aMatch := matchLines(o, a) // base→ours の一致行ペア (oi,ai)
	bMatch := matchLines(o, b) // base→theirs の一致行ペア (oi,bi)

	bm := make(map[int]int, len(bMatch))
	for _, p := range bMatch {
		bm[p[0]] = p[1]
	}

	// base 行が ours/theirs の両方で一致する点を「同期点」とする。
	// aMatch・bMatch は各々 oi/ai(bi) が単調増加なので、その共通部分も単調増加。
	type sync struct{ oi, ai, bi int }
	var syncs []sync
	for _, p := range aMatch {
		oi, ai := p[0], p[1]
		if bi, ok := bm[oi]; ok {
			syncs = append(syncs, sync{oi, ai, bi})
		}
	}
	// 末尾の番兵（残り領域を処理するため）
	syncs = append(syncs, sync{len(o), len(a), len(b)})

	var out []string
	conflicted := false
	lastO, lastA, lastB := 0, 0, 0

	for _, s := range syncs {
		oReg := o[lastO:s.oi]
		aReg := a[lastA:s.ai]
		bReg := b[lastB:s.bi]

		switch {
		case equalLines(aReg, oReg) && equalLines(bReg, oReg):
			out = append(out, oReg...) // 双方とも未変更
		case equalLines(aReg, oReg):
			out = append(out, bReg...) // theirs のみ変更
		case equalLines(bReg, oReg):
			out = append(out, aReg...) // ours のみ変更
		case equalLines(aReg, bReg):
			out = append(out, aReg...) // 双方が同一内容に変更
		default:
			conflicted = true
			out = append(out, mergeMarkerOurs)
			out = append(out, aReg...)
			out = append(out, mergeMarkerMiddle)
			out = append(out, bReg...)
			out = append(out, mergeMarkerTheirs)
		}

		if s.oi < len(o) {
			out = append(out, o[s.oi]) // 同期行（3者共通）を1度だけ出力
		}
		lastO, lastA, lastB = s.oi+1, s.ai+1, s.bi+1
	}

	return strings.Join(out, "\n"), conflicted
}

// fallbackConcat は3-wayマージを行わず、ours/theirs 全文をマーカーで併記する。
func fallbackConcat(ours, theirs string) string {
	return mergeMarkerOurs + "\n" + ours + "\n" + mergeMarkerMiddle + "\n" + theirs + "\n" + mergeMarkerTheirs
}

// splitLines は改行で行に分割する。strings.Join("\n") で元に戻せる。
func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

// equalLines は2つの行スライスが完全一致するかを判定する。
func equalLines(x, y []string) bool {
	if len(x) != len(y) {
		return false
	}
	for i := range x {
		if x[i] != y[i] {
			return false
		}
	}
	return true
}

// matchLines は2つの行スライスの一致行ペア (a側index, b側index) を
// 昇順で返す。行を rune にエンコードして diffmatchpatch の行差分を取る。
func matchLines(a, b []string) [][2]int {
	ea, eb := encodeLines(a, b)
	d := dmp.New()
	diffs := d.DiffMain(ea, eb, false)

	var pairs [][2]int
	ai, bi := 0, 0
	for _, df := range diffs {
		n := len([]rune(df.Text))
		switch df.Type {
		case dmp.DiffEqual:
			for k := 0; k < n; k++ {
				pairs = append(pairs, [2]int{ai, bi})
				ai++
				bi++
			}
		case dmp.DiffDelete:
			ai += n
		case dmp.DiffInsert:
			bi += n
		}
	}
	return pairs
}

// encodeLines は各行を一意な rune に割り当て、行列を rune 列の文字列へ変換する。
// 行数は diff3MaxLines で抑えられているため rune がサロゲート領域に達することはない。
func encodeLines(a, b []string) (string, string) {
	m := make(map[string]rune)
	var next rune = 1
	enc := func(lines []string) string {
		var sb strings.Builder
		for _, ln := range lines {
			r, ok := m[ln]
			if !ok {
				r = next
				m[ln] = r
				next++
			}
			sb.WriteRune(r)
		}
		return sb.String()
	}
	return enc(a), enc(b)
}
