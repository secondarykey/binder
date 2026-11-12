package setup_test

import (
	"binder/fs"
	"binder/settings"
	_ "binder/setup"

	"testing"
)

// バインダーごとの署名が無いとき、fs がアプリの設定の名前とメールで署名すること。
// 設定を変えれば、渡し直さなくても次の署名に反映される。
func TestDefaultUserComesFromSettings(t *testing.T) {
	g := settings.Get().Git
	name, mail := g.Name, g.Mail
	defer func() { g.Name, g.Mail = name, mail }()

	g.Name, g.Mail = "Signature test", "signature_test@localhost"
	sig := fs.UserSig()
	if sig.Name != "Signature test" || sig.Email != "signature_test@localhost" {
		t.Fatalf("UserSig() = %q <%s>, want 設定の値", sig.Name, sig.Email)
	}

	g.Name = "Changed"
	if got := fs.UserSig().Name; got != "Changed" {
		t.Fatalf("設定を変えたあとの UserSig().Name = %q, want Changed", got)
	}
}
