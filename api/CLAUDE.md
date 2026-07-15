# api パッケージ（Wails v3 APIレイヤー）

`App` 構造体を Wails v3 Service として登録し、フロントエンドにメソッドを公開する薄い層。
ビジネスロジックは持たず、`a.current`（開いている `*binder.Binder`）への委譲が原則。

## App 構造体と初期化（api.go / setup.go）

- `App{ current, version, devMode, SearchEmitter, WindowCloser, ... }`
- `SearchEmitter` / `BinderWindowCloser` はインターフェース。Wails依存の実装は `_cmd/binder/` 側で注入する（api パッケージは wails のイベント発火・ウィンドウ操作に直接依存しない）
- 初期化フロー: `main()` が `api.New(version)` → `application.NewService(app)` で登録 → 開発モード判定後に **`app.Setup()`** を直接呼ぶ（`setup.EnsureExists()`＝アプリレベルマイグレーション含む）。Wails の `ServiceStartup` は実装していない
- `CheckCompat(dir)` / `Convert(dir)` — バインダーレベルマイグレーションの入口。panic を recover してエラーに変換する

## API メソッドの規約

新しいバインドメソッドは以下のパターンに従う:

```go
func (a *App) DoSomething(id string) (*json.Xxx, error) {
	defer log.PrintTrace(log.Func("DoSomething()"))

	rtn, err := a.current.DoSomething(id)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)  // ユーザ向けエラーへ変換（Skill: binder-user-error）
	}
	return rtn, nil
}
```

- 入出力のモデル型は `api/json/` を使う（`db/model` を直接公開しない）
- **メソッドを追加・変更したらフロントエンドバインディングを再生成する**（`cd _cmd/binder && wails3 task common:generate:bindings`）
- バインダー未オープンで呼ばれ得るメソッドは `a.current == nil` を確認する（例: `SearchBinder`）

## ファイル別の責務

- **api.go** — `App` 本体、`GetVersionInfo`、非同期検索（`SearchBinder`）、`Address` / `EnsureAddress`（HTTPサーバ遅延起動）
- **binder.go** — バインダーの Load/Create/Close/CreateRemote、公開（`Generate` / `GenerateAll` / `Unpublish*`）。`LoadBinder` はクラッシュ検出フラグ `StartupOk` の管理も行う
- **git.go** — 最大のファイル。記録（`Commit` / `CommitFiles` / `AutoSave`）、リモートCRUD・Push・PushDocs、マージ（`MergeFromRemote` / `MergeFromLocal` / `ApplyMergeResolution`）、履歴・復元、ブランチ操作、`*ByPath` 系（バインダーを開かずにディレクトリ指定で履歴操作）、クリーンアップ（`SquashHistory` / `RunGC`）
- **note.go / diagram.go / assets.go / layer.go / template.go / structure.go** — エンティティ別 CRUD・コンテンツの読み書き
- **tree.go** — 各種ツリー取得（Binder/Template/Modified/Unpublished/Published）と `MoveNode`
- **html.go** — プレビュー・公開用HTMLの生成（`CreateNoteHTML` / `Parse*`）
- **download.go** — エクスポート（docs一括・単一ノート）
- **config.go** — バインダー設定（binder.json）と git 認証情報（`GetUserInfo` / `EditUserInfo`）
- **setting.go** — アプリ設定（`settings` パッケージへの委譲）。テーマ・言語・フォント・エディタ設定等
- **snippet.go** — スニペット設定の読み書き（アプリレベル、`settings` へ委譲）
- **setup.go** — `Setup` / `CheckCompat` / `Convert`
- **error.go / message.go** — `userError` / `MessageError` / `MarshalError`（詳細は Skill: `binder-user-error`）
- **plugin.go / app_plugin.go / rootfile.go** — プラグイン・ルートファイル（詳細は Skill: `binder-plugin-rootfile`）

## サブパッケージ

- **json/** — API入出力用のモデル型（`db/model` とは別物。フロントエンドと受け渡す形）
- **lite/** — Binder Lite の Service（fs/db に依存しない。詳細は `_cmd/lite/CLAUDE.md`）
- **shared/** — Binder/Lite 共通の第3 Service（テーマ・言語・フォント一覧）
