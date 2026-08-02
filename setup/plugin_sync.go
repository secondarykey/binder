package setup

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"

	"binder/log"
	"binder/settings"

	"golang.org/x/xerrors"
)

// 同梱プラグインの「Binder がこれまで配布した既知ハッシュ」。
//
// SyncSamplePlugins はユーザの ~/.binder/plugins/marked/<file> のハッシュが
// この既知集合に含まれる場合のみ（＝ユーザが編集していないと判断できる場合のみ）
// 最新の同梱版で上書きする。ユーザが編集したファイル・意図的に削除したファイルは触らない。
//
// 同梱プラグインを更新するたびに、直前バージョンの sha256 をここへ追記すること
// （現行の同梱版ハッシュは実行時に算出して自動的に既知集合へ加わる）。
// 各要素は配布順（[0] が最も古い）。
//   1つめ: 0.12.0〜0.13.1 で配布したバージョン（0.14.0 で inline 委譲・@marked 付与に更新）
//   2つめ: 0.14.0 で配布したバージョン（0.15.0 で @plugin-version 付与・marked-info は Version 行追加に更新）
// 0.14.0 で @plugin-version を持っていた5本（highlight / kbd / subscript / superscript /
// underline）は 0.15.0 で内容が変わらないため 2つめが無い。
var shippedPluginHashes = map[string][]string{
	"abbreviations.js": {
		"4ac8986afafc460eb532b2ddb81be1d56bc8d20a752c91c551fb8316cb820cdb",
		"1e6051787959504f736f09bd20b0aae5ea9181e2db3a27b9512c5d6d918631eb",
	},
	"containers.js": {
		"328a46c15aca9e5f460a2e473355735ae3b3aafa2fe80e1cc48952ba9520a97c",
		"a8520671f04e27b8364ec5222dc34a979d8bad5c071b76ac571b0291f6a38b96",
	},
	"definition-list.js": {
		"6240db0fe44b8e85a25a84f49176730a822b85f23bcdd2ce39362b4cb9f425df",
		"5474e5d5271cc098ba68958faec6f5c1a2e07d361609365fc9c1816322beeb4d",
	},
	"emoji.js": {
		"d69d08b2b4abd03a59d373fc1ef74a1e239a0e2da28899b00c882107330cef24",
		"a8d2d1cb39f93a8997c8fc76a6ec401ddde69a1211cdbb6df590fa55dfbd070e",
	},
	"example.js": {
		"d9299ebf5d81b7b7c33e0f0fa5de50cd94cae19964fdb65a3e5d9dcdbedd4752",
		"127fb9e71d4fc7711608bbd2a1aee83b3dc7f66539a29439619f5c67b9f4ddac",
	},
	"footnotes.js": {
		"a7336ecea767eb2336d4068a2fa92c0c4d3af4075beada1819627874885bed43",
		"5459539fbb145314787f72f565c6dde94b00d193d009a432d27218113b8be787",
	},
	"github-alerts.js": {
		"610b07964dda65c23684417c5b9968808f923565af74f180f8487686361bd709",
		"43917581671aaae6fc3fed369b55b151d53fba889ba59c0d78aa9fca7787f99a",
	},
	"highlight.js": {"e4ccb846deb793dcb6be29e380fca99a2ec593cc63091bcf1ff104782c2dbf2b"},
	"kbd.js":       {"f716c2a6f86156296aa38678c82910e5645d3edb25a8b225a9dd114ff1be130b"},
	"marked-info.js": {
		"beed61584295c9916b230c3b9a2f96e434a710dcdfd0cb34954a38b57e4460ab",
		"f33b86057537a3a1d11fb275f552fc605c8c5f2989776e6548d22ccf7f036645",
	},
	"smartypants.js": {
		"86656e9856087d37a554af1bf956df4111480c3ddf436ba53a0a9ff216f4becb",
		"537c56a63160ae7df4b46820dfc4eaefbecbd7b7eb6ec641b5e72c7351ed0cb6",
	},
	"subscript.js":   {"1253b01aed774475bae4c93e056b8c3e7e4e839f97f91dafac605b4f3ab5cbf6"},
	"superscript.js": {"8a132e963a5bcf6574fb8a7739869360626c7551e16c8cd28735af5b2f0fb7b0"},
	"toc.js": {
		"e065001bfeaab9d2ea025db56eed1d7f69305e9b7a78502c85fd25bf4b6ba239",
		"ae349624a8e05088f4ef049c17b6ec6f075c557a9400076044341010bc2174b5",
	},
	"underline.js": {"fd7f977c4ba884ef05b9d2116575f8415038fc17139fab498aaeb52b400ab20c"},
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// SyncSamplePlugins は同梱 marked プラグインの更新をユーザ環境へ反映する。
//
// 対象は ~/.binder/plugins/marked/ に「既に存在する」ファイルのみ。
// ユーザ編集ファイル（既知ハッシュに一致しない）と、削除済みファイル（存在しない）は触らない。
// example.js は参考テンプレートのため対象外（InstallSamplePlugins と揃える）。
func SyncSamplePlugins() error {

	dir := settings.PluginsEngineDirPath("marked")

	entries, err := embFs.ReadDir("_assets/plugins/marked")
	if err != nil {
		return xerrors.Errorf("embFs.ReadDir error: %w", err)
	}

	skip := map[string]bool{"example.js": true}

	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || skip[name] || !strings.HasSuffix(name, ".js") {
			continue
		}

		userPath := filepath.Join(dir, name)
		userData, err := os.ReadFile(userPath)
		if err != nil {
			// 存在しない（削除された・未インストール）ファイルは追加しない
			continue
		}

		bundled, err := embFs.ReadFile("_assets/plugins/marked/" + name)
		if err != nil {
			return xerrors.Errorf("embFs.ReadFile(%s) error: %w", name, err)
		}

		curHash := sha256Hex(bundled)
		userHash := sha256Hex(userData)

		// 既に最新なら何もしない
		if userHash == curHash {
			continue
		}

		// ユーザのファイルが「Binder が配布した既知バージョン」なら未編集とみなし上書きする
		if !isKnownShippedHash(name, userHash, curHash) {
			log.Info("SyncSamplePlugins: skip user-modified plugin: %s", name)
			continue
		}

		if err := os.WriteFile(userPath, bundled, 0644); err != nil {
			return xerrors.Errorf("os.WriteFile(%s) error: %w", userPath, err)
		}
		log.Info("SyncSamplePlugins: updated %s", name)
	}

	return nil
}

// isKnownShippedHash は hash が name の既知配布ハッシュ（過去バージョン + 現行同梱版）に
// 含まれるかを返す。
func isKnownShippedHash(name, hash, currentHash string) bool {
	if hash == currentHash {
		return true
	}
	for _, h := range shippedPluginHashes[name] {
		if h == hash {
			return true
		}
	}
	return false
}
