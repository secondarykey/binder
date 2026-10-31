package binder

import (
	"io"
	"path"
	"regexp"
	"strings"

	"binder/log"
)

// 公開サイトの URL（OGP の og:url / og:image に要る絶対 URL の基準）。
//
// バインダー設定（binder.json の siteUrl）にあればそれを使う。無ければ手元の情報から推し量る:
//   - docs/CNAME（GitHub Pages の独自ドメイン）があれば https://<CNAME>/
//   - リモートが github.com/<user>/<repo> なら https://<user>.github.io/<repo>/
//     （<repo> が <user>.github.io なら https://<user>.github.io/）
// docs/ だけを公開ブランチのサブディレクトリへ送る設定なら、その名前を後ろに付ける。

// githubRemotePattern は GitHub のリモート URL（https / ssh / git@）から user と repo を取り出す。
var githubRemotePattern = regexp.MustCompile(`(?i)github\.com[:/]+([^/]+)/([^/]+?)(?:\.git)?/?$`)

// SiteURL は公開サイトの URL（末尾は /）を返す。設定も推し量りもできなければ空。
func (b *Binder) SiteURL() string {
	if b == nil {
		return ""
	}
	meta, err := b.fileSystem.LoadMetaData()
	if err != nil {
		log.Warnf("SiteURL: LoadMetaData() error:\n%+v", err)
		return ""
	}
	if meta != nil && strings.TrimSpace(meta.SiteURL) != "" {
		return normalizeSiteURL(meta.SiteURL)
	}
	return b.GuessSiteURL()
}

// GuessSiteURL は設定が無いときに使う、推し量った公開サイトの URL を返す。分からなければ空。
func (b *Binder) GuessSiteURL() string {
	if b == nil {
		return ""
	}

	subDir := ""
	if meta, err := b.fileSystem.LoadMetaData(); err == nil && meta != nil && meta.PublishOnly {
		subDir = meta.PublishSubDir
	}

	cname := ""
	if f, err := b.fileSystem.Open(path.Join(b.fileSystem.GetPublic(), "CNAME")); err == nil {
		buf, _ := io.ReadAll(f)
		f.Close()
		cname = string(buf)
	}

	remoteURL := ""
	if remotes, err := b.fileSystem.GetRemotes(); err == nil {
		for _, r := range remotes {
			if len(r.URLs) == 0 {
				continue
			}
			// origin を優先し、無ければ最初のリモート
			if r.Name == "origin" || remoteURL == "" {
				remoteURL = r.URLs[0]
			}
			if r.Name == "origin" {
				break
			}
		}
	}

	return guessSiteURL(cname, remoteURL, subDir)
}

// guessSiteURL は CNAME の中身・リモート URL・公開先のサブディレクトリからサイトの URL を推し量る。
func guessSiteURL(cname, remoteURL, subDir string) string {
	base := ""
	// CNAME は 1 行目にドメインを書く
	if host := strings.TrimSpace(strings.SplitN(cname, "\n", 2)[0]); host != "" {
		host = strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://")
		base = "https://" + strings.Trim(host, "/") + "/"
	} else if m := githubRemotePattern.FindStringSubmatch(strings.TrimSpace(remoteURL)); m != nil {
		user := strings.ToLower(m[1])
		repo := m[2]
		if strings.EqualFold(repo, user+".github.io") {
			base = "https://" + user + ".github.io/"
		} else {
			base = "https://" + user + ".github.io/" + repo + "/"
		}
	}
	if base == "" {
		return ""
	}
	if sub := strings.Trim(strings.ReplaceAll(subDir, "\\", "/"), "/"); sub != "" {
		base += sub + "/"
	}
	return base
}

// normalizeSiteURL は設定されたサイトの URL の末尾を / に揃える。
func normalizeSiteURL(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasSuffix(s, "/") {
		s += "/"
	}
	return s
}
