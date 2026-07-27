# macOS 署名・notarization

## なぜ必要か

`_cmd/binder/build/darwin/Taskfile.yml` の `package` タスクは、最後に ad-hoc 署名
（`codesign --force --deep --sign -`）を行う。これはビルドしたマシン上では動作するが、
**配布には使えない**。

GitHub Releases から zip をダウンロードすると macOS は `com.apple.quarantine` 拡張属性を
付与し、Gatekeeper は ad-hoc 署名かつ未 notarize の `.app` の起動を拒否する。

> 「"binder"は壊れているため開けません。ゴミ箱に入れる必要があります。」

実際にファイルが壊れているわけではなく、署名が Gatekeeper の要求を満たしていないだけである。
0.13.1 の macOS 版が実端末で起動しなかったのはこれが原因。

## CI の挙動

`.github/workflows/release.yml` は、下記の Secrets が **すべて** 登録されている場合のみ
Developer ID 署名 + notarize + staple を実行する。1つでも欠けていると警告を出して従来どおり
ad-hoc 署名にフォールバックするため、証明書がなくてもワークフローは失敗しない。

| ステップ | 署名あり | 署名なし（フォールバック） |
|---|---|---|
| ビルド | `wails3 task darwin:sign:notarize` | `wails3 package` |
| 署名 | Developer ID + hardened runtime | ad-hoc |
| notarize / staple | あり | なし |
| 実機での起動 | そのまま起動可能 | `xattr` での回避が必要 |

## 必要な Secrets

| Secret 名 | 内容 |
|---|---|
| `MACOS_CERT_P12` | Developer ID Application 証明書（`.p12`）を base64 エンコードした文字列 |
| `MACOS_CERT_PASSWORD` | `.p12` 書き出し時に設定したパスワード |
| `MACOS_SIGN_IDENTITY` | 署名 ID。例: `Developer ID Application: secondarykey (TEAMID)` |
| `MACOS_NOTARY_APPLE_ID` | Apple ID（メールアドレス） |
| `MACOS_NOTARY_TEAM_ID` | 10文字の Team ID |
| `MACOS_NOTARY_PASSWORD` | App-specific password（Apple ID のログインパスワードではない） |

## 準備手順

前提: Apple Developer Program への加入（年 $99）が必要。

### 1. Developer ID Application 証明書を作成する

Xcode の `Settings > Accounts > Manage Certificates` から `Developer ID Application` を作成する
（または Apple Developer サイトの Certificates で CSR を使って発行する）。

### 2. `.p12` として書き出す

キーチェーンアクセスで証明書と秘密鍵をまとめて選択し、`.p12` として書き出す。
書き出し時のパスワードが `MACOS_CERT_PASSWORD` になる。

### 3. base64 に変換する

```bash
base64 -i DeveloperID.p12 | pbcopy
```

この文字列を `MACOS_CERT_P12` に登録する。

### 4. 署名 ID を確認する

```bash
security find-identity -v -p codesigning
```

出力の `"Developer ID Application: ..."` の引用符の中身をそのまま
`MACOS_SIGN_IDENTITY` に登録する。

### 5. App-specific password を作る

<https://account.apple.com/> の「サインインとセキュリティ > App用パスワード」で生成し、
`MACOS_NOTARY_PASSWORD` に登録する。

### 6. Team ID を確認する

Apple Developer の Membership ページに表示される10文字の ID を
`MACOS_NOTARY_TEAM_ID` に登録する。

## ローカルで署名する場合

```bash
cd _cmd/binder
wails3 task darwin:sign:notarize \
  SIGN_IDENTITY="Developer ID Application: secondarykey (TEAMID)" \
  KEYCHAIN_PROFILE="binder-notarize"
```

`KEYCHAIN_PROFILE` は事前に作成しておく必要がある。

```bash
xcrun notarytool store-credentials "binder-notarize" \
  --apple-id "you@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

## 検証

配布 zip を展開したあと、実際にダウンロードした状態を再現して確認する。

```bash
# 署名の確認
codesign -dv --verbose=4 binder.app

# Gatekeeper の判定（accepted なら配布可能）
spctl -a -vvv -t install binder.app

# notarization ticket が staple されているか
xcrun stapler validate binder.app
```

## 注意点

- notarize は Apple のサーバに送信して結果を待つ（`notarytool submit --wait`）ため、
  リリースジョブの所要時間が数分単位で伸びる
- `_cmd/binder/build/darwin/Taskfile.yml` の `SIGN_IDENTITY` / `KEYCHAIN_PROFILE` は
  コメントアウトされたままにしておく。CI からは task の CLI 変数で上書きしているため、
  ファイルに書くと `wails3 update build-assets` での再生成時に失われる可能性がある
- CI は macOS ランナーのアーキテクチャ（`macos-15` = arm64）でのみビルドするため、
  成果物は arm64 単体。Intel Mac にも配布するなら `darwin:package:universal` への
  切り替えが別途必要
