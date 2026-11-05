package fs

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"binder/api/json"

	"golang.org/x/xerrors"
)

// アセットの alias の検証。
//
// alias は公開先のパスを兼ねる（docs/assets/{alias}）。先頭が "/" のものは
// サイトのルート（docs/{alias}）に置く（_docs/site-root-files.md）。

// ErrInvalidAlias は公開先のパスとして使えない alias（"/" を含む・".." 等）のエラー。
var ErrInvalidAlias = errors.New("invalid alias")

// ErrInvalidNoteAlias はノートの alias が公開先のパスとして使えないエラー（ErrInvalidAlias の一種）。
// アセットと規則が違う（ルートに置けるのは "/404" だけ）ため、メッセージを分けられるよう別にする。
var ErrInvalidNoteAlias = fmt.Errorf("%w: note", ErrInvalidAlias)

// ErrReservedAlias は Binder が公開ディレクトリの直下で使う名前と重なる alias のエラー。
var ErrReservedAlias = errors.New("reserved alias")

// rootAliasNamePattern はルートのアセットの名前（先頭の "/" を除いた部分）。
// 先頭のドットは許す（.nojekyll のため）。サブディレクトリは扱わない。
var rootAliasNamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

// reservedPublicRootNames は Binder が公開ディレクトリの直下に出すもの（小文字比較）。
var reservedPublicRootNames = map[string]bool{
	"index.html":    true, // index ノートの出力先
	ErrorPageName:   true, // 404 ページ（alias "/404" のノート）の出力先
	pagesDir:        true,
	resourceDir:     true,
	publicAssetsDir: true,
	publicLayersDir: true,
}

// IsRootAlias はサイトのルートに置くアセットの alias（先頭が "/"）かどうかを返す。
func IsRootAlias(alias string) bool {
	return strings.HasPrefix(alias, "/")
}

// IsReservedPublicRootName は公開ディレクトリの直下で Binder が使う名前かどうかを返す。
// Windows のファイルシステムは大文字小文字を区別しないため小文字で比較する。
func IsReservedPublicRootName(name string) bool {
	return reservedPublicRootNames[strings.ToLower(name)]
}

// ValidateAssetAlias はアセットの alias が公開先のパスとして使えるかを検証する。
//
//   - 空は許す（公開されない）
//   - "/" で始まるもの: 続く名前が 1 階層の英数字・"." "_" "-" だけで、予約名・"." ".."・".git…" でない
//   - それ以外: "/" "\" を含まず、"." ".." でない（docs/assets の外に書き出さないため）
func ValidateAssetAlias(alias string) error {
	if alias == "" {
		return nil
	}

	if IsRootAlias(alias) {
		name := strings.TrimPrefix(alias, "/")
		if !rootAliasNamePattern.MatchString(name) || isDotName(name) ||
			strings.HasPrefix(strings.ToLower(name), ".git") {
			return xerrors.Errorf("%w: %s", ErrInvalidAlias, alias)
		}
		if IsReservedPublicRootName(name) {
			return xerrors.Errorf("%w: %s", ErrReservedAlias, alias)
		}
		return nil
	}

	if strings.ContainsAny(alias, `/\`) || isDotName(alias) {
		return xerrors.Errorf("%w: %s", ErrInvalidAlias, alias)
	}
	return nil
}

func isDotName(name string) bool {
	return name == "." || name == ".."
}

// ValidateNoteAlias はノートの alias が公開先のパスとして使えるかを検証する。
//
//   - 空は許す（従来どおり）
//   - "/404"（json.ErrorPageAlias）は 404 ページ。docs/404.html に公開する。index ノートには使えない
//   - それ以外の "/" で始まるものは不可（ノートをサイトのルートに置けるのは 404 ページだけ）
//   - "/" "\" を含むもの、"." ".." は不可（docs/pages の外に書き出さないため）
func ValidateNoteAlias(id, alias string) error {
	if alias == "" {
		return nil
	}
	if json.IsErrorPageAlias(alias) {
		if id == "index" {
			return xerrors.Errorf("%w: index note cannot be the error page", ErrInvalidNoteAlias)
		}
		return nil
	}
	if strings.ContainsAny(alias, `/\`) || isDotName(alias) {
		return xerrors.Errorf("%w: %s", ErrInvalidNoteAlias, alias)
	}
	return nil
}
