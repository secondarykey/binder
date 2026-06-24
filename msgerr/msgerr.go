// Package msgerr はユーザ向けの構造化エラーを提供する。
//
// Wails v3 はバインドメソッドが返した error を
// CallError{ Message: err.Error(), Cause: MarshalError(err), Kind: "RuntimeError" }
// として JSON 化しフロントへ送る。フロントは err.message にこの envelope JSON を受け取る。
// 本パッケージの Marshal を application.Options.MarshalError に登録することで、
// envelope の cause に {body, detail, cause} の構造化データを載せ、フロント側で
// ユーザフレンドリーに表示できるようにする。
package msgerr

import (
	"encoding/json"
	"errors"
	"fmt"
)

// MessageError はユーザに提示する構造化エラー。
//   - Body:   スナックバー等に1行で表示するユーザ向けメッセージ
//   - Detail: 詳細情報（任意。ダブルクリックで表示）
//   - Cause:  原因となった元 error（任意。デバッグ・errors.Is/As チェーン用）
type MessageError struct {
	Body   string
	Detail string
	Cause  error
}

// Error は人間可読の1行を返す（ログ・envelope.message 用）。Body を優先する。
// Error() 自体は JSON にしない（ログが汚れないようにするため）。
func (e *MessageError) Error() string {
	if e.Body != "" {
		return e.Body
	}
	if e.Detail != "" {
		return e.Detail
	}
	if e.Cause != nil {
		return e.Cause.Error()
	}
	return "error"
}

// Unwrap は errors.Is/As のチェーンを維持する。
func (e *MessageError) Unwrap() error {
	return e.Cause
}

// jsonPayload は cause に載せる構造化 JSON。キーは小文字。
type jsonPayload struct {
	Body   string `json:"body"`
	Detail string `json:"detail,omitempty"`
	Cause  string `json:"cause,omitempty"`
}

// MarshalJSON は Wails の cause に載せる構造化 JSON を返す。
// cause には %+v でフォーマットした原因エラーを入れる。xerrors でラップされたエラーは
// これによりスタックトレース（関数名・file:line）を含み、フロントの折りたたみ
// デバッグ情報で技術的詳細を確認できる（Error() は1行のままログ用に保つ）。
func (e *MessageError) MarshalJSON() ([]byte, error) {
	p := jsonPayload{Body: e.Body, Detail: e.Detail}
	if e.Cause != nil {
		p.Cause = fmt.Sprintf("%+v", e.Cause)
	}
	return json.Marshal(p)
}

// New は body のみの MessageError を生成する。
func New(body string) *MessageError {
	return &MessageError{Body: body}
}

// Newf は body をフォーマットして MessageError を生成する。
func Newf(format string, a ...interface{}) *MessageError {
	return &MessageError{Body: fmt.Sprintf(format, a...)}
}

// Wrap は元 error を Cause に保持しつつ body を付与する。
func Wrap(cause error, body string) *MessageError {
	return &MessageError{Body: body, Cause: cause}
}

// Wrapf は元 error を Cause に保持しつつ body をフォーマットして付与する。
func Wrapf(cause error, format string, a ...interface{}) *MessageError {
	return &MessageError{Body: fmt.Sprintf(format, a...), Cause: cause}
}

// WithDetail は body と detail を持つ MessageError を生成する。
func WithDetail(cause error, body, detail string) *MessageError {
	return &MessageError{Body: body, Detail: detail, Cause: cause}
}

// Marshal は application.Options.MarshalError に登録する関数。
// err のチェーンに *MessageError があればその構造化 JSON を返し、
// 無ければ nil を返して Wails のデフォルト処理にフォールバックする。
func Marshal(err error) []byte {
	var me *MessageError
	if errors.As(err, &me) {
		b, jerr := json.Marshal(me)
		if jerr != nil {
			return nil
		}
		return b
	}
	return nil
}
