package binder

import (
	"binder/fs"
	"log/slog"

	"os/exec"
	"strings"

	"golang.org/x/xerrors"
)

const editorFileMark = "{file}"

func (b *Binder) RunEditor(mode, id string) error {

	//TODO 設定から取得
	bash := true
	entry := "\"D:\\Program Files\\Git\\git-bash.exe\" -c \"/usr/bin/vim {file}\""

	fn := b.fileSystem.ToFullPath(mode, id)
	slog.Info(fn)

	//設定から取得
	ch, err := runEditor(entry, fn, bash)
	if err != nil {
		return xerrors.Errorf("runEditor() error: %w", err)
	}

	err = <-ch
	if err != nil {
		return xerrors.Errorf("editor chanel error: %w", err)
	}
	return nil
}

func runEditor(entry, fn string, winBash bool) (chan error, error) {

	if winBash {
		fn = fs.ToGitBash(fn)
	}

	//区切り文字のスライスを作成
	lines := splitDQSpace(entry)

	cmd := ""
	fm := false

	var args []string
	for idx, bk := range lines {
		if idx == 0 {
			cmd = bk
		} else {
			word := bk
			idx := strings.Index(word, editorFileMark)
			if idx != -1 {
				word = strings.ReplaceAll(word, editorFileMark, fn)
				fm = true
			}
			args = append(args, word)
		}
	}

	if !fm {
		return nil, xerrors.Errorf("file mark[%s] error", editorFileMark)
	}

	if len(args) <= 0 {
		return nil, xerrors.Errorf("command arguments error")
	}

	exe := exec.Command(cmd, args...)
	err := exe.Start()
	if err != nil {
		return nil, xerrors.Errorf("command start error: %w", err)
	}

	ch := make(chan error)
	go func(ch chan error) {
		err := exe.Wait()
		ch <- err
	}(ch)

	return ch, nil
}

/**
 * ダブルコーテーション込のスペース区切り
 */
func splitDQSpace(v string) []string {

	// ダブルコーテーションで分割
	parts := strings.Split(v, "\"")
	var result []string

	for i, part := range parts {
		if i%2 == 0 {
			// ダブルコーテーション外の部分をスペースで分割
			words := strings.Fields(part)
			result = append(result, words...)
		} else {
			// ダブルコーテーション内の部分をそのまま追加
			result = append(result, part)
		}
	}

	return result
}
