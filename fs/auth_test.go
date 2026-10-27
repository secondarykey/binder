package fs

import (
	"testing"

	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

// トークン認証は Bearer ではなく、Basic 認証のパスワードにトークンを入れて送る
func TestAuthMethodToken(t *testing.T) {
	auth, err := authMethod(&UserInfo{AuthType: AuthToken, Token: "ghp_token"})
	if err != nil {
		t.Fatalf("authMethod() error: %v", err)
	}
	basic, ok := auth.(*http.BasicAuth)
	if !ok {
		t.Fatalf("authMethod() = %T, want *http.BasicAuth", auth)
	}
	if basic.Password != "ghp_token" {
		t.Errorf("Password = %q, want the token", basic.Password)
	}
	if basic.Username == "" {
		t.Error("Username is empty, want a placeholder")
	}
}
