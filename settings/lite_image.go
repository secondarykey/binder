package settings

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

// Lite で貼り付けた画像は、Markdown ファイルの隣の「<ファイル名>.assets/」に置く。
// 本文には「<ファイル名>.assets/<画像>」の相対パスで書く（VS Code や GitHub でもそのまま見られる）。
// 保存前のワークは ~/.binder/lite/works/<ワーク名>.assets/ に置き、
// ファイルとして保存するときに保存先の隣へ写して本文のパスを書き換える（RelocateLiteAssets）。

const (
	// LiteAssetsSuffix は画像を置くフォルダの名前の後ろに付ける文字
	LiteAssetsSuffix = ".assets"
	// liteImageMaxSize はプレビューで読み込む画像の大きさの上限
	liteImageMaxSize = 30 * 1024 * 1024
	// liteImageMaxIndex は同じ時刻の画像の名前を探す上限
	liteImageMaxIndex = 999
)

// liteImageMimes は扱う画像の拡張子と MIME
var liteImageMimes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".svg":  "image/svg+xml",
}

// liteSchemePattern は URL のスキーム（http: data: など）。Windows のドライブ文字（C:）は 2 文字以上なので除く
var liteSchemePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]+:`)

// liteAssetBase は画像の置き場所の基準になるディレクトリと名前（.assets の前に付く部分）を返す。
// docPath があればそのファイルの隣、無ければワークの隣。
func liteAssetBase(docPath, work string) (string, string, error) {
	if docPath != "" {
		base := filepath.Base(docPath)
		return filepath.Dir(docPath), strings.TrimSuffix(base, filepath.Ext(base)), nil
	}
	if work != "" {
		if !liteWorkNamePattern.MatchString(work) {
			return "", "", xerrors.Errorf("invalid work name: %q", work)
		}
		return LiteWorkDirPath(), work, nil
	}
	return "", "", xerrors.Errorf("no document path or work name")
}

// SaveLiteImage は画像を「<ファイル名>.assets/」に保存し、本文に書く相対パス（/ 区切り）を返す。
// data は base64、ext は拡張子（".png" など）。名前は保存した日時から作る。
func SaveLiteImage(docPath, work, data, ext string) (string, error) {

	ext = strings.ToLower(ext)
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	if _, ok := liteImageMimes[ext]; !ok {
		return "", xerrors.Errorf("unsupported image type: %s", ext)
	}
	buf, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return "", xerrors.Errorf("base64 decode error: %w", err)
	}

	dir, stem, err := liteAssetBase(docPath, work)
	if err != nil {
		return "", err
	}
	assets := filepath.Join(dir, stem+LiteAssetsSuffix)
	if err := os.MkdirAll(assets, 0755); err != nil {
		return "", xerrors.Errorf("os.MkdirAll(%s) error: %w", assets, err)
	}

	base := time.Now().Format("20060102-150405")
	for i := 1; i <= liteImageMaxIndex; i++ {
		name := base + ext
		if i > 1 {
			name = fmt.Sprintf("%s-%d%s", base, i, ext)
		}
		p := filepath.Join(assets, name)
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			if os.IsExist(err) {
				continue
			}
			return "", xerrors.Errorf("os.OpenFile(%s) error: %w", p, err)
		}
		_, werr := f.Write(buf)
		cerr := f.Close()
		if werr != nil || cerr != nil {
			os.Remove(p)
			return "", xerrors.Errorf("write image(%s) error: %v %v", p, werr, cerr)
		}
		return stem + LiteAssetsSuffix + "/" + name, nil
	}
	return "", xerrors.Errorf("image name exhausted (max %d)", liteImageMaxIndex)
}

// ReadLiteImage は本文の相対パスの画像を読み、data URI で返す（プレビュー用）。
// 画像の拡張子のものだけを読む。絶対パスや URL は読まない。
func ReadLiteImage(docPath, work, src string) (string, error) {

	if src == "" || liteSchemePattern.MatchString(src) || strings.HasPrefix(src, "/") || strings.HasPrefix(src, `\`) || filepath.IsAbs(src) {
		return "", xerrors.Errorf("not a relative path: %q", src)
	}
	mime, ok := liteImageMimes[strings.ToLower(filepath.Ext(src))]
	if !ok {
		return "", xerrors.Errorf("not an image: %q", src)
	}

	dir, _, err := liteAssetBase(docPath, work)
	if err != nil {
		return "", err
	}
	p := filepath.Join(dir, filepath.FromSlash(src))
	info, err := os.Stat(p)
	if err != nil {
		return "", xerrors.Errorf("os.Stat(%s) error: %w", p, err)
	}
	if info.IsDir() || info.Size() > liteImageMaxSize {
		return "", xerrors.Errorf("not a readable image: %s", p)
	}
	buf, err := os.ReadFile(p)
	if err != nil {
		return "", xerrors.Errorf("os.ReadFile(%s) error: %w", p, err)
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(buf), nil
}

// RelocateLiteAssets は、保存先が変わるときに本文が参照している画像を新しい「<ファイル名>.assets/」へ写し、
// 本文のパスを書き換えて返す。保存先が同じなら何もしない。
//
// 書き換えるのは「<元のファイル名>.assets/<画像>」の形で、実際にあるものだけ。
// 写し先に同じ名前の別の画像があるときは、名前を変えて写す（上書きしない）。
// 元の画像は消さない（名前を付けて保存した元のファイルが残るため）。
func RelocateLiteAssets(fromPath, fromWork, toPath, content string) (string, error) {

	if fromPath == "" && fromWork == "" {
		return content, nil
	}
	oldDir, oldStem, err := liteAssetBase(fromPath, fromWork)
	if err != nil {
		return content, err
	}
	newDir, newStem, err := liteAssetBase(toPath, "")
	if err != nil {
		return content, err
	}
	if filepath.Clean(oldDir) == filepath.Clean(newDir) && oldStem == newStem {
		return content, nil
	}

	oldAssets := filepath.Join(oldDir, oldStem+LiteAssetsSuffix)
	newAssets := filepath.Join(newDir, newStem+LiteAssetsSuffix)
	newPrefix := newStem + LiteAssetsSuffix + "/"

	// 「(」「<」「"」「'」空白・行頭の直後にある「(./)<元のファイル名>.assets/<画像>」
	re := regexp.MustCompile(`(^|[(<\s"'])(\./)?` + regexp.QuoteMeta(oldStem+LiteAssetsSuffix+"/") + `([^\s)>"'/\\]+)`)

	copied := make(map[string]string)
	var firstErr error
	var out strings.Builder
	last := 0
	for _, m := range re.FindAllStringSubmatchIndex(content, -1) {
		name := content[m[6]:m[7]]
		newName, ok := copied[name]
		if !ok {
			src := filepath.Join(oldAssets, name)
			if info, err := os.Stat(src); err != nil || info.IsDir() {
				continue
			}
			newName, err = copyLiteAsset(src, newAssets, name)
			if err != nil {
				if firstErr == nil {
					firstErr = err
				}
				continue
			}
			copied[name] = newName
		}
		// 前の区切り文字と ./ は残し、.assets から後ろを書き換える
		start := m[5]
		if m[4] < 0 {
			start = m[3]
		}
		out.WriteString(content[last:start])
		out.WriteString(newPrefix)
		out.WriteString(newName)
		last = m[1]
	}
	out.WriteString(content[last:])
	return out.String(), firstErr
}

// copyLiteAsset は src を dir/name に写し、写した名前を返す。
// 同じ名前で中身も同じものがあればそれを使い、中身が違えば名前を変える。
func copyLiteAsset(src, dir, name string) (string, error) {

	buf, err := os.ReadFile(src)
	if err != nil {
		return "", xerrors.Errorf("os.ReadFile(%s) error: %w", src, err)
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", xerrors.Errorf("os.MkdirAll(%s) error: %w", dir, err)
	}

	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 1; i <= liteImageMaxIndex; i++ {
		n := name
		if i > 1 {
			n = fmt.Sprintf("%s-%d%s", stem, i, ext)
		}
		p := filepath.Join(dir, n)
		if exist, err := os.ReadFile(p); err == nil {
			if bytes.Equal(exist, buf) {
				return n, nil
			}
			continue
		}
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			if os.IsExist(err) {
				continue
			}
			return "", xerrors.Errorf("os.OpenFile(%s) error: %w", p, err)
		}
		_, werr := f.Write(buf)
		cerr := f.Close()
		if werr != nil || cerr != nil {
			os.Remove(p)
			return "", xerrors.Errorf("copy image(%s) error: %v %v", p, werr, cerr)
		}
		return n, nil
	}
	return "", xerrors.Errorf("image name exhausted (max %d)", liteImageMaxIndex)
}

// liteWorkAssetsPath はワークの画像フォルダのパスを返す。
func liteWorkAssetsPath(name string) (string, error) {
	if !liteWorkNamePattern.MatchString(name) {
		return "", xerrors.Errorf("invalid work name: %q", name)
	}
	return filepath.Join(LiteWorkDirPath(), name+LiteAssetsSuffix), nil
}
