package binder

import (
	"encoding/base64"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// encodeDataURI は MIME タイプとバイト列から data URI 文字列を生成する。
func encodeDataURI(mimeType string, data []byte) string {
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
}

// AssetDataURI はアセットを data URI（data:{mime};base64,...）で返す。
// エディタプレビュー（local）でHTTPサーバに依存せず画像を埋め込むために使う。
// MIME は Asset.Mime を優先し、未設定の場合は Alias/Name の拡張子、
// それも判定できなければ内容から推定する（servePrivateAsset と同じ優先順）。
func (b *Binder) AssetDataURI(id string) (string, error) {
	if b == nil {
		return "", EmptyError
	}

	data, a, err := b.ReadAssetBytes(id)
	if err != nil {
		return "", xerrors.Errorf("ReadAssetBytes() error: %w", err)
	}

	mimeType := a.Mime
	if mimeType == "" {
		name := a.Alias
		if name == "" {
			name = a.Name
		}
		if ext := filepath.Ext(name); ext != "" {
			mimeType = mime.TypeByExtension(ext)
		}
	}
	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	// "text/plain; charset=utf-8" のようなパラメータ付きでも data URI に有効
	mimeType = strings.TrimSpace(mimeType)

	return encodeDataURI(mimeType, data), nil
}

// MetaImageDataURI はノートのメタ画像を data URI で返す。
// メタ画像が存在しない場合は空文字を返す（エラーではない）。
// メタ画像は MIME 情報を持たないため、内容から推定する。
func (b *Binder) MetaImageDataURI(noteId string) (string, error) {
	if b == nil {
		return "", EmptyError
	}

	data, err := b.ReadMetaBytes(noteId)
	if err != nil {
		return "", xerrors.Errorf("ReadMetaBytes() error: %w", err)
	}
	if data == nil {
		return "", nil
	}

	mimeType := strings.TrimSpace(http.DetectContentType(data))
	return encodeDataURI(mimeType, data), nil
}
