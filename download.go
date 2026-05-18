package binder

import (
	"archive/zip"
	"binder/api/json"
	"binder/fs"
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

	return createZip(savePath, docsDir, nil)
}

// DownloadAll はバインダー全体の内容をZIPファイルとして保存する。
// user_data.enc は含めない。
func (b *Binder) DownloadAll(savePath string) error {

	if b == nil {
		return EmptyError
	}

	// 除外ファイル
	excludes := map[string]bool{
		fs.UserFileName:  true,
		fs.GitIgnoreFile: true,
	}

	return createZip(savePath, b.dir, excludes)
}

// createZip は baseDir 以下のファイルをZIPファイルとして savePath に保存する。
// excludes に指定されたファイル名（ベース名）は除外する。
func createZip(savePath, baseDir string, excludes map[string]bool) error {

	outFile, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer outFile.Close()

	w := zip.NewWriter(outFile)
	defer w.Close()

	err = filepath.Walk(baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			// .git ディレクトリはスキップ
			if info.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		// 除外ファイルをスキップ
		if excludes != nil && excludes[info.Name()] {
			return nil
		}

		// baseDir からの相対パスをZIP内のパスにする
		rel, err := filepath.Rel(baseDir, path)
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

// CollectExportDeps はノートのエクスポートに必要な依存関係を収集し、
// フロントエンドでSVG生成が必要なダイアグラムのリストを返す。
func (b *Binder) CollectExportDeps(noteId string, text string) (*json.ExportDeps, error) {

	if b == nil {
		return nil, EmptyError
	}

	note, err := b.GetNote(noteId)
	if err != nil {
		return nil, xerrors.Errorf("GetNote() error: %w", err)
	}

	expanded, err := b.ParseNote(note, false, text)
	if err != nil {
		return nil, xerrors.Errorf("ParseNote() error: %w", err)
	}

	_, deps, err := b.CreateNoteHTMLForExport(note, expanded)
	if err != nil {
		return nil, xerrors.Errorf("CreateNoteHTMLForExport() error: %w", err)
	}

	result := &json.ExportDeps{}
	for id, diag := range deps.diagrams {
		svgPath := fs.SVGFile(diag)
		if _, err := b.fileSystem.Stat(svgPath); err != nil {
			result.MissingDiagrams = append(result.MissingDiagrams, json.ExportDiagram{
				Id:   id,
				Name: diag.Name,
			})
		}
	}
	return result, nil
}

// DownloadNote はノートを自己完結したZIPとしてエクスポートする。
// diagramSVGs はフロントエンドでMermaid.jsにより生成されたSVGデータ（key=diagramId）。
func (b *Binder) DownloadNote(noteId string, text string, diagramSVGs map[string]string, savePath string) error {

	if b == nil {
		return EmptyError
	}

	note, err := b.GetNote(noteId)
	if err != nil {
		return xerrors.Errorf("GetNote() error: %w", err)
	}

	expanded, err := b.ParseNote(note, false, text)
	if err != nil {
		return xerrors.Errorf("ParseNote() error: %w", err)
	}

	htmlStr, deps, err := b.CreateNoteHTMLForExport(note, expanded)
	if err != nil {
		return xerrors.Errorf("CreateNoteHTMLForExport() error: %w", err)
	}

	return b.writeExportZip(savePath, []byte(htmlStr), note, deps, diagramSVGs)
}

func (b *Binder) writeExportZip(savePath string, html []byte, note *json.Note, d *exportDeps, diagramSVGs map[string]string) error {

	outFile, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("os.Create() error: %w", err)
	}
	defer outFile.Close()

	w := zip.NewWriter(outFile)
	defer w.Close()

	// index.html
	f, err := w.Create("index.html")
	if err != nil {
		return xerrors.Errorf("zip create index.html error: %w", err)
	}
	if _, err := f.Write(html); err != nil {
		return xerrors.Errorf("zip write index.html error: %w", err)
	}

	// assets
	for id, a := range d.assets {
		if a.Alias == "" {
			continue
		}
		data, _, err := b.ReadAssetBytes(id)
		if err != nil {
			continue
		}
		zipPath := "assets/" + a.Alias
		af, err := w.Create(zipPath)
		if err != nil {
			continue
		}
		af.Write(data)
	}

	// diagrams
	for id, diag := range d.diagrams {
		if diag.Alias == "" {
			continue
		}
		zipPath := "images/" + diag.Alias + ".svg"

		var svgData []byte
		if data, ok := diagramSVGs[id]; ok && data != "" {
			svgData = []byte(data)
		} else {
			svgPath := fs.SVGFile(diag)
			sf, err := b.fileSystem.Open(svgPath)
			if err != nil {
				continue
			}
			svgData, err = io.ReadAll(sf)
			sf.Close()
			if err != nil {
				continue
			}
		}

		df, err := w.Create(zipPath)
		if err != nil {
			continue
		}
		df.Write(svgData)
	}

	// layers
	for id, l := range d.layers {
		if l.Alias == "" {
			continue
		}
		svg, err := b.BuildLayerSVGForId(id)
		if err != nil {
			continue
		}
		zipPath := "layers/" + l.Alias + ".svg"
		lf, err := w.Create(zipPath)
		if err != nil {
			continue
		}
		lf.Write([]byte(svg))
	}

	// meta image
	metaData, err := b.ReadMetaBytes(note.Id)
	if err == nil && metaData != nil && note.Alias != "" {
		zipPath := "images/meta/" + note.Alias
		mf, err := w.Create(zipPath)
		if err == nil {
			mf.Write(metaData)
		}
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
