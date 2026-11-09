package setup

import (
	"errors"
	"strings"
	"testing"
)

func TestRootFileTemplates(t *testing.T) {
	names, err := RootFileTemplates()
	if err != nil {
		t.Fatalf("RootFileTemplates() error: %v", err)
	}
	found := false
	for _, n := range names {
		if n == "AGENTS.md" {
			found = true
		}
	}
	if !found {
		t.Fatalf("RootFileTemplates() = %v, want AGENTS.md", names)
	}
}

func TestRootFileTemplateLanguages(t *testing.T) {
	ja, err := RootFileTemplate("AGENTS.md", "ja")
	if err != nil {
		t.Fatalf("RootFileTemplate(ja) error: %v", err)
	}
	en, err := RootFileTemplate("AGENTS.md", "en")
	if err != nil {
		t.Fatalf("RootFileTemplate(en) error: %v", err)
	}
	if ja == en {
		t.Error("ja と en の雛形が同じ")
	}
	if strings.Contains(ja, "\r") || strings.Contains(en, "\r") {
		t.Error("雛形の改行が LF にそろっていない")
	}
	// どちらの言語でも、外部のツールが守る要点を含む
	for _, s := range []string{ja, en} {
		for _, want := range []string{".git/binder-open.lock", "db/structures.csv", "UUID v7"} {
			if !strings.Contains(s, want) {
				t.Errorf("雛形に %q が無い", want)
			}
		}
	}

	// 雛形の無い言語は英語
	fr, err := RootFileTemplate("AGENTS.md", "fr")
	if err != nil || fr != en {
		t.Errorf("RootFileTemplate(fr) = (len %d, %v), want the English template", len(fr), err)
	}
}

func TestRootFileTemplateNotFound(t *testing.T) {
	for _, name := range []string{"", "NOPE.md", "../languages/ja.json", `en\AGENTS.md`} {
		if _, err := RootFileTemplate(name, "ja"); !errors.Is(err, ErrNoRootFileTemplate) {
			t.Errorf("RootFileTemplate(%q) error = %v, want ErrNoRootFileTemplate", name, err)
		}
	}
	// 言語にパスを渡しても雛形の外は読まない（英語へフォールバックする）
	if s, err := RootFileTemplate("AGENTS.md", "../languages"); err != nil || !strings.Contains(s, "This directory is a binder") {
		t.Errorf("RootFileTemplate(lang=../languages) = %v", err)
	}
}
