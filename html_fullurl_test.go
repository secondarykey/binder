package binder_test

import (
	"binder"
	"binder/test"
	"fmt"
	"strings"
	"testing"
)

// fullURLOf は id のノートで elm を公開時の形（local=false）で評価して返す。
func fullURLOf(t *testing.T, b *binder.Binder, id, elm string) (string, []string) {
	t.Helper()
	n, err := b.GetNote(id)
	if err != nil {
		t.Fatalf("GetNote() error: %v", err)
	}
	html, warnings, err := b.ParseNote(n, false, elm)
	if err != nil {
		t.Fatalf("ParseNote() error: %v", err)
	}
	return html, warnings
}

func setSiteURL(t *testing.T, b *binder.Binder, u string) {
	t.Helper()
	conf, err := b.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error: %v", err)
	}
	conf.SiteURL = u
	if err := b.EditConfig(conf); err != nil {
		t.Fatalf("EditConfig() error: %v", err)
	}
}

// TestFullURL は fullURL が、サイトの URL を基準に今のページ・エントリ・相対パスの絶対 URL を返すことを検証する。
func TestFullURL(t *testing.T) {
	b := test.CreateBinder(t, "full_url")
	defer b.Close()

	setSiteURL(t, b, " https://example.com/site ")
	conf, err := b.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error: %v", err)
	}
	if conf.SiteURL != "https://example.com/site" {
		t.Errorf("GetConfig().SiteURL = %q", conf.SiteURL)
	}

	page := createDoctorNote(t, b, "page")
	other := createDoctorNote(t, b, "other")
	pn, _ := b.GetNote(page)
	on, _ := b.GetNote(other)

	got, _ := fullURLOf(t, b, page, `{{ fullURL }}`)
	if want := "https://example.com/site/pages/" + pn.Alias + ".html"; got != want {
		t.Errorf("fullURL (page) = %q, want %q", got, want)
	}

	got, _ = fullURLOf(t, b, "index", `{{ fullURL }}`)
	if want := "https://example.com/site/"; got != want {
		t.Errorf("fullURL (index) = %q, want %q", got, want)
	}

	got, _ = fullURLOf(t, b, page, fmt.Sprintf(`{{ fullURL "%s" }}`, other))
	if want := "https://example.com/site/pages/" + on.Alias + ".html"; got != want {
		t.Errorf("fullURL (id) = %q, want %q", got, want)
	}

	got, _ = fullURLOf(t, b, page, `{{ fullURL "../assets/meta/x" }}`)
	if want := "https://example.com/site/assets/meta/x"; got != want {
		t.Errorf("fullURL (relative) = %q, want %q", got, want)
	}
}

// TestFullURLUnknownSite は、サイトの URL が分からないときに相対パスを返し、公開時に警告することを検証する。
func TestFullURLUnknownSite(t *testing.T) {
	b := test.CreateBinder(t, "full_url_unknown")
	defer b.Close()

	if u := b.SiteURL(); u != "" {
		t.Skipf("site URL is guessed from the test binder: %q", u)
	}
	page := createDoctorNote(t, b, "page")
	pn, _ := b.GetNote(page)

	got, warnings := fullURLOf(t, b, page, `{{ fullURL }}`)
	if want := "../pages/" + pn.Alias + ".html"; got != want {
		t.Errorf("fullURL = %q, want %q", got, want)
	}
	found := false
	for _, w := range warnings {
		if strings.Contains(w, "site URL") {
			found = true
		}
	}
	if !found {
		t.Errorf("no warning about the site URL: %v", warnings)
	}
}
