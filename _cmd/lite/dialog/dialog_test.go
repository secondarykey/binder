package dialog

import (
	"errors"
	"fmt"
	"testing"
)

func TestPath(t *testing.T) {
	failure := errors.New("failed to open dialog")

	tests := []struct {
		name     string
		path     string
		err      error
		wantPath string
		wantErr  error
	}{
		{"selected", `C:\work\a.md`, nil, `C:\work\a.md`, nil},
		{"cancelled on macOS / Linux", "", nil, "", nil},
		{"cancelled on Windows", "", errors.New("cancelled by user"), "", nil},
		{"other error is passed through", "", failure, "", failure},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Path(tt.path, tt.err)
			if got != tt.wantPath {
				t.Errorf("path = %q, want %q", got, tt.wantPath)
			}
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestIsCancelled(t *testing.T) {
	if !IsCancelled(errors.New("cancelled by user")) {
		t.Error("IsCancelled(cancelled by user) = false, want true")
	}
	if IsCancelled(nil) {
		t.Error("IsCancelled(nil) = true, want false")
	}
	// 包まれたエラーは取り消しとみなさない（Wails は包まずに返す）
	if IsCancelled(fmt.Errorf("wrap: %w", errors.New("cancelled by user"))) {
		t.Error("IsCancelled(wrapped) = true, want false")
	}
	if IsCancelled(errors.New("failed to open dialog")) {
		t.Error("IsCancelled(other) = true, want false")
	}
}
