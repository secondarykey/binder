package binder

import "testing"

// guessSiteURL は CNAME・GitHub のリモート・公開先のサブディレクトリからサイトの URL を推し量る
func TestGuessSiteURL(t *testing.T) {
	for _, c := range []struct {
		name, cname, remote, sub, want string
	}{
		{"https", "", "https://github.com/secondarykey/binder.git", "", "https://secondarykey.github.io/binder/"},
		{"https without .git", "", "https://github.com/Owner/Repo", "", "https://owner.github.io/Repo/"},
		{"https with user", "", "https://user@github.com/owner/repo.git", "", "https://owner.github.io/repo/"},
		{"scp-like ssh", "", "git@github.com:owner/repo.git", "", "https://owner.github.io/repo/"},
		{"ssh scheme", "", "ssh://git@github.com/owner/repo.git", "", "https://owner.github.io/repo/"},
		{"user site", "", "https://github.com/owner/owner.github.io.git", "", "https://owner.github.io/"},
		{"sub dir", "", "https://github.com/owner/repo.git", "/en/", "https://owner.github.io/repo/en/"},
		{"cname wins", "docs.example.com\n", "https://github.com/owner/repo.git", "", "https://docs.example.com/"},
		{"cname with scheme", "https://docs.example.com/", "", "", "https://docs.example.com/"},
		{"not github", "", "https://gitlab.com/owner/repo.git", "", ""},
		{"nothing", "", "", "", ""},
	} {
		if got := guessSiteURL(c.cname, c.remote, c.sub); got != c.want {
			t.Errorf("%s: guessSiteURL() = %q, want %q", c.name, got, c.want)
		}
	}
}
