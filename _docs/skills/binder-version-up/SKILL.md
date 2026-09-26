---
name: binder-version-up
description: >
  Binderのバージョン変更（バージョンアップ）手順を提供する。
  _cmd/version.go による6ファイルの一括更新、バージョンの実体ファイル（_cmd/binder/version）、
  wails3 update build-assets によるプラットフォームバージョン（info.json / Info.plist）の同期、
  その必須フラグ（-name / -binaryname を APP_NAME と一致させる）と nfpm.yaml homepage の巻き戻り、
  CI（versionup.yml / release.yml）との関係、macOS 署名・notarize の有無による配布物の違いを扱う。
  「バージョンを上げる」「バージョン変更」「リリース準備」「build-assets の再生成」といった作業では
  必ずこのSkillを参照すること。
---

# バージョン変更手順

指定されたバージョンにする:

```bash
go run ./_cmd/version.go 0.0.0
```

以下の6ファイルのバージョンが引数のバージョンに変更される:

- `./_cmd/binder/version`
- `./_cmd/lite/version`
- `./_cmd/binder/build/config.yml`
- `./_cmd/binder/frontend/package.json`
- `./_cmd/lite/build/config.yml`
- `./_cmd/lite/frontend/package.json`

`_cmd/binder/version` がバージョンの実体で、`main.go` は `//go:embed version` で読み込む。

## プラットフォームバージョンの注意

`_cmd/binder/build/windows/info.json`（`file_version` / `ProductVersion`）と
`_cmd/binder/build/darwin/Info.plist`（`CFBundleShortVersionString` / `CFBundleVersion`）にも
バージョン文字列があるが、`_cmd/version.go` の更新対象**外**である。これらは CI（`.github/workflows/versionup.yml`）の
`wails3 update build-assets` ステップで `config.yml` のバージョンから再生成・同期される。

ローカルで `go run _cmd/version.go` だけを実行した場合は info 系が取り残されるため、
ローカルでプラットフォームバージョンまで揃えたいときは `wails3 update build-assets` を併せて実行すること。

## `wails3 update build-assets` の必須フラグと落とし穴

**引数なしで実行してはならない。** 必ず `-name` / `-binaryname` / `-config` / `-dir` を明示する。
CI（`versionup.yml`）と同一のコマンドは以下:

```bash
cd _cmd/binder
wails3 update build-assets -name "Binder" -binaryname "binder" -config build/config.yml -dir build

cd _cmd/lite
wails3 update build-assets -name "Binder Lite" -binaryname "binder-lite" -config build/config.yml -dir build
```

### 1. `-binaryname` は Taskfile の `APP_NAME` と一致させる（最重要）

`-binaryname` は生成物中の**実行ファイル名**を決める。各アプリの `Taskfile.yml` の
`APP_NAME`（binder = `binder` / lite = `binder-lite`）が実際にビルドされるバイナリ名なので、
ここがズレると以下が実体と食い違う:

- `build/darwin/Info.plist` / `Info.dev.plist` の `CFBundleExecutable`
- `build/linux/nfpm/nfpm.yaml` の `name` と `contents` の src/dst（バイナリ・アイコン・desktop）
- `build/linux/desktop` の `Exec` / `Icon` / `StartupWMClass`

macOS/Windows は case-insensitive なので大文字小文字のズレは**顕在化しにくいが、Linux の
nfpm パッケージングは実際に壊れる**（存在しない `./bin/Binder` を参照して失敗する）。
過去に `-binaryname "Binder"` が指定されていて長期間気づかれなかった実績がある（2026-07 修正済み）。

`-name` は表示名（`Binder` / `Binder Lite`）で、`-binaryname` とは別物。混同しないこと。

### 2. `nfpm.yaml` の `homepage` が巻き戻る

実行のたびにテンプレートのハードコード値 `https://wails.io` に戻る。`config.yml` の
`info.homepage` からは反映されない。CI では sed 後処理で修正しているので、**ローカル実行後は
手動で戻すこと**:

```bash
sed -i 's|homepage: "https://wails.io"|homepage: "https://github.com/secondarykey/binder"|' build/linux/nfpm/nfpm.yaml
```

### 3. Taskfile は上書きされない

`-dir build` 配下でも `build/Taskfile.yml` や `build/darwin/Taskfile.yml` は再生成対象外
（2026-07-28 実測、alpha2.117）。ただし恒久設定をそこに書くのは避け、CI からは task の
CLI 変数で上書きする方針にしている（例: 署名の `SIGN_IDENTITY`）。

## 次回リリース時の確認事項（2026-09-23 時点で未確認）

以下は `release.yml` の変更後、まだタグビルドで一度も通していない。次にタグを打ったら
Multi-OS Build の結果と配布物を確認し、問題なければこの節を削除する。

- **macOS: `macos-15` → `macos-latest`（macOS 26 / Xcode 26.6）に変更**（#63）。
  確認用ワークフローでは Binder / Lite の `wails3 package`（ad-hoc 署名）まで通っている。
  未確認なのは、Developer ID 署名 + notarize（`darwin:sign:notarize`）を macOS 26 で通すことと、
  配布物が実機で起動し、アイコンが表示されること。
  失敗したら、まず `generate:icons` に `-iconcomposerinput` が戻っていないかを見る（Skill: `wails3` の pitfalls.md 11）
- **Linux: `ubuntu-24.04` に固定**。v0.16.4 のビルドは成功済み。配布物が要求する glibc が 2.39 以下であることは未確認
  （`objdump -T binder | grep -o 'GLIBC_[0-9.]*' | sort -uV | tail -1`）
- **Go バージョン: `.github/variables` の `GO_VERSION` を参照するよう変更**。v0.16.4 のビルドは成功済み

## リリース時の注意（Linux: ランナーの固定）

`release.yml` のビルド matrix は Linux を `ubuntu-24.04` に固定している（`ubuntu-latest` に戻さない）。
README の対応範囲（Ubuntu 24.04 / Debian 13 以降）と glibc を合わせるため。理由と確認方法は Skill: `wails3`（pitfalls.md 16）を参照。

## リリース時の注意（macOS）

タグを push すると `.github/workflows/release.yml` が走る。macOS 版は Developer ID の
Secrets が揃っている場合のみ署名 + notarize され、未設定なら ad-hoc 署名にフォールバックする。
ad-hoc のまま配布した成果物は実機で「壊れているため開けません」となり起動できないため、
その状態でリリースする場合はリリースノートに `xattr` の回避手順を載せる。

詳細（必要な Secrets・証明書の準備・検証コマンド）は `_docs/macos-signing.md` を参照。

## 関連

- セマンティックバージョンの比較・操作はGoコードでは `internal.Version`（`internal/version.go`）を使用する。直接文字列比較は不可
- コミットメッセージは `chore: バージョンアップ` 等のConventional Commits形式（末尾に「Glory to mankind.」）
