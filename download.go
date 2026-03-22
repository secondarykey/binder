package binder

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// DownloadDocs は docs/ ディレクトリの内容をZIPファイルとして保存する
func (b *Binder) DownloadDocs(savePath string) error {

	if b == nil {
		return EmptyError
	}

	pub := b.fileSystem.GetPublic()
	docsDir := filepath.Join(b.dir, pub)

	// docsディレクトリの存在確認
	info, err := os.Stat(docsDir)
	if err != nil || !info.IsDir() {
		return xerrors.Errorf("docs directory not found: %s", docsDir)
	}

	outFile, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer outFile.Close()

	w := zip.NewWriter(outFile)
	defer w.Close()

	err = filepath.Walk(docsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		// docsDir からの相対パスをZIP内のパスにする
		rel, err := filepath.Rel(docsDir, path)
		if err != nil {
			return xerrors.Errorf("filepath.Rel() error: %w", err)
		}
		// ZIP内のパス区切りはスラッシュで統一
		rel = strings.ReplaceAll(rel, "\\", "/")

		f, err := w.Create(rel)
		if err != nil {
			return xerrors.Errorf("zip.Create() error: %w", err)
		}

		src, err := os.Open(path)
		if err != nil {
			return xerrors.Errorf("os.Open() error: %w", err)
		}
		defer src.Close()

		_, err = io.Copy(f, src)
		if err != nil {
			return xerrors.Errorf("io.Copy() error: %w", err)
		}

		return nil
	})

	if err != nil {
		return xerrors.Errorf("filepath.Walk() error: %w", err)
	}

	return nil
}

// GetBinderName はバインダー名を返す（ダウンロードファイル名生成用）
func (b *Binder) GetBinderName() (string, error) {

	if b == nil {
		return "", EmptyError
	}

	conf, err := b.GetConfig()
	if err != nil {
		return "", xerrors.Errorf("GetConfig() error: %w", err)
	}
	return conf.Name, nil
}
