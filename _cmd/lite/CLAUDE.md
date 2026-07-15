# Binder Lite

Binder Lite は軽量版の Markdown/Mermaid エディタ。git管理・DB・ツリー階層・公開機能を持たず、OSの任意ファイルを直接開いて編集する。

## ビルド・開発コマンド

```bash
# 開発モードで起動（_cmd/lite/ から実行）
cd _cmd/lite && task dev

# プロダクションビルド
cd _cmd/lite && task build
```

## 起動引数

```bash
# 複数ファイルを指定して起動（存在しないパスは無視）
binder-lite file1.md file2.mmd file3.md
```

## アーキテクチャ

```
React フロントエンド (MUI, Vite)
    ↓ Wails v3 バインディング (frontend/bindings/binder/api/lite/app.js)
api/lite/api.go — 薄い Service（ファイルI/O + テーマ/言語）
    ↓
os.ReadFile / os.WriteFile（標準ライブラリ）
setup/, settings/（Binder と共有）
```

## Go バックエンド

- **`lite.App`** (api/lite/api.go) — Wails v3 Service。`ReadFile`, `SaveFile`（アトミック書き込み）、テーマ・言語は `settings` パッケージに委譲。起動引数ファイルの管理（`SetInitialFiles` / `InitialFiles`）
- **`Window`** (_cmd/lite/window.go) — 第2 Service。ファイルダイアログ（Open/Save）、新規ファイル作成、ウィンドウ操作
- Binder の `fs/`, `db/`, `api/` には一切依存しない
- Lite は `binder/api` を import できないため `MarshalError` を登録していない（`MessageError` を生成しないので実害なし。共有が必要になったら lite が import できるパッケージへ切り出す）

## フロントエンド構成 (frontend/src/)

- **main.jsx** — エントリポイント。テーマ・言語の初期化、shared エンジンの vendor URL 設定
- **App.jsx** — メインコンポーネント。タブ管理、スプリッター、プレビュー折りたたみ、テーマモード、確認ダイアログ
- **TitleBar.jsx** — フレームレスウィンドウ用カスタムタイトルバー。ファイル操作ボタン（New/Open/Save）+ テーマ切り替え + ウィンドウ操作（最小化/最大化/閉じる）
- **TabBar.jsx** — ファイルタブバー。オーバーフロー時の左右スクロールボタン付き
- **EditorPane.jsx** — エディタラッパー。共有 EditorArea + SearchBar + Markdown入力支援 + 行番号トグル（左上）+ 折り返しトグル（右下）
- **PreviewPane.jsx** — プレビュー。共有 HTMLFrame + Marked/Mermaid エンジン。Markdown/Mermaid 切り替えボタン（右上）。`MutationObserver` でテーマ変更を検知し再描画
- **ConfirmDialog.jsx** — カスタム確認ダイアログ（Promise ベース）
- **theme.js** — テーマ管理。system/light/dark の3モード対応。system モードは `prefers-color-scheme` を監視
- **language.jsx** — i18next 初期化
- **useHasScrollbar.js** — スクロールバー検出フック（`useScrollbarOffset`, `useHScrollbarOffset`, `useIframeScrollbarOffset`）。ボタン位置調整用

共有エディタコンポーネントは `@shared/editor/...` を直接 import する（旧 `components/editor/` は削除済み）。詳細は `_cmd/shared/frontend/CLAUDE.md` を参照。

## 主な機能

- タブ式マルチファイル編集（`.md`, `.mmd`, `.mermaid` 等）
- 左右分割レイアウト（エディタ + プレビュー）、スプリッターでサイズ調整
- プレビューの折りたたみ・展開（アニメーション付き）
- Markdown/Mermaid プレビュー切り替え（タブごとに保持）
- Markdown 入力支援（リスト・チェックリスト・引用・番号リストの自動継続）
- Ctrl+S 明示的保存（アトミック書き込み）、未保存マーク表示
- テーマ切り替え（system/light/dark）
- ファイルドロップ対応（`EnableFileDrop` + `data-file-drop-target`）
- フレームレスウィンドウ（`--wails-draggable` でドラッグ領域制御）

## タブデータ構造

```js
{
  id,            // タブID
  path,          // ファイルパス
  filename,      // 表示名
  content,       // 現在のエディタ内容
  savedContent,  // 最後に保存した内容
  mermaidMode,   // Mermaid プレビューモード
}
```
