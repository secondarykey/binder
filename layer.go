package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	jsonenc "encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"strings"

	"golang.org/x/xerrors"
)

// LayerShape は layers/{id}.json の shapes 配列の要素を表す。
// 正規化座標 (0.0-1.0) で保存される。Type によって使用される座標フィールドが異なる。
type LayerShape struct {
	Id          string  `json:"id"`
	Type        string  `json:"type"`
	Color       string  `json:"color"`
	StrokeWidth float64 `json:"strokeWidth"`
	Fill        string  `json:"fill,omitempty"`

	// line: x1,y1,x2,y2
	X1 float64 `json:"x1,omitempty"`
	Y1 float64 `json:"y1,omitempty"`
	X2 float64 `json:"x2,omitempty"`
	Y2 float64 `json:"y2,omitempty"`

	// rect: x,y,width,height
	X      float64 `json:"x,omitempty"`
	Y      float64 `json:"y,omitempty"`
	Width  float64 `json:"width,omitempty"`
	Height float64 `json:"height,omitempty"`

	// ellipse: cx,cy,rx,ry
	Cx float64 `json:"cx,omitempty"`
	Cy float64 `json:"cy,omitempty"`
	Rx float64 `json:"rx,omitempty"`
	Ry float64 `json:"ry,omitempty"`
}

type LayerContent struct {
	Shapes []LayerShape `json:"shapes"`
}

func (b *Binder) EditLayer(l *json.Layer) (*json.Layer, error) {

	if b == nil {
		return nil, EmptyError
	}

	var prefix string
	var files []string

	if l.Id == "" {

		l.Id = b.generateId()
		l.Alias = l.Id

		f, err := b.fileSystem.CreateLayerFile(l)
		if err != nil {
			return nil, xerrors.Errorf("fs.CreateLayerFile() error: %w", err)
		}
		files = append(files, f)

		m := model.ConvertLayer(l)
		err = b.db.InsertLayer(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.InsertLayer() error: %w", err)
		}

		err = b.createStructure(l.Id, l.ParentId, "layer", l.Name, l.Detail, l.Alias)
		if err != nil {
			return nil, xerrors.Errorf("createStructure() error: %w", err)
		}

		prefix = "Create Layer"
	} else {

		_, err := b.db.GetLayer(l.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetLayer() error: %w", err)
		}

		oldS, err := b.db.GetStructure(l.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
		}
		willPrivatize := l.Private && !oldS.Publish.IsZero()
		if willPrivatize {
			oldLayer := &json.Layer{Alias: oldS.Alias}
			fn, err := b.fileSystem.UnpublishLayer(oldLayer)
			if err != nil {
				return nil, xerrors.Errorf("fs.UnpublishLayer() error: %w", err)
			}
			files = append(files, fn)
		} else if oldS.Alias != l.Alias {
			renamedFiles, err := b.fileSystem.RenamePublishedLayer(oldS.Alias, l.Alias)
			if err != nil {
				return nil, xerrors.Errorf("fs.RenamePublishedLayer() error: %w", err)
			}
			files = append(files, renamedFiles...)
		}

		m := model.ConvertLayer(l)
		err = b.db.UpdateLayer(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateLayer() error: %w", err)
		}

		err = b.updateStructure(l.Id, l.ParentId, l.Name, l.Detail, l.Alias, l.Private, l.Publish, l.Republish)
		if err != nil {
			return nil, xerrors.Errorf("updateStructure() error: %w", err)
		}

		prefix = "Edit Layer"
	}

	files = append(files, fs.LayerTableFile(), fs.StructureTableFile())
	err := b.fileSystem.Commit(fs.M(prefix, l.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return l, nil
}

func (b *Binder) GetLayer(id string) (*json.Layer, error) {
	if b == nil {
		return nil, EmptyError
	}
	l, err := b.db.GetLayer(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetLayer() error: %w", err)
	}

	m := l.To()

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}
	m.ApplyStructure(s.To())

	err = b.fileSystem.SetLayerStatus(m)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetLayerStatus() error: %w", err)
	}

	return m, nil
}

// GetLayerWithParent はレイヤーと親アセット情報を返す。
func (b *Binder) GetLayerWithParent(id string) (*json.Layer, error) {
	if b == nil {
		return nil, EmptyError
	}

	m, err := b.GetLayer(id)
	if err != nil {
		return nil, xerrors.Errorf("GetLayer() error: %w", err)
	}

	a, err := b.GetAsset(m.ParentId)
	if err != nil {
		return nil, xerrors.Errorf("GetAsset() error: %w", err)
	}
	m.Parent = a

	return m, nil
}

func (b *Binder) ReadLayer(w io.Writer, id string) error {
	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.ReadLayer(w, id)
	if err != nil {
		return xerrors.Errorf("fs.ReadLayer() error: %w", err)
	}
	return nil
}

func (b *Binder) SaveLayer(id string, data []byte) error {
	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.WriteLayer(id, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteLayer() error: %w", err)
	}
	return nil
}

func (b *Binder) RemoveLayer(id string) (*json.Layer, error) {
	if b == nil {
		return nil, EmptyError
	}

	l, err := b.db.GetLayer(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetLayer() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	m := l.To()
	m.ApplyStructure(s.To())

	files, err := b.fileSystem.DeleteLayer(m)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteLayer() error: %w", err)
	}

	err = b.db.DeleteLayer(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteLayer() error: %w", err)
	}

	err = b.db.DeleteStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteStructure() error: %w", err)
	}

	files = append(files, fs.LayerTableFile(), fs.StructureTableFile())

	err = b.fileSystem.Commit(fs.M("Remove Layer", m.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return m, nil
}

func (b *Binder) GetUnpublishedLayers() ([]*json.Layer, error) {

	all, err := b.db.FindLayers()
	if err != nil {
		return nil, xerrors.Errorf("db.FindLayers() error: %w", err)
	}

	ids := make([]interface{}, len(all))
	for i, l := range all {
		ids[i] = l.Id
	}
	structMap, err := b.getStructureMap(ids...)
	if err != nil {
		return nil, xerrors.Errorf("getStructureMap() error: %w", err)
	}

	pr := make([]*json.Layer, 0, len(all))

	for _, l := range all {
		m := l.To()
		if s, ok := structMap[l.Id]; ok {
			m.ApplyStructure(s.To())
		}

		err = b.fileSystem.SetLayerStatus(m)
		if err != nil {
			return nil, xerrors.Errorf("SetLayerStatus() error: %w", err)
		}

		if m.Private || m.PublishStatus == json.LatestStatus {
			continue
		}
		pr = append(pr, m)
	}
	return pr, nil
}

// PublishLayerStage はレイヤーのSVGを公開ディレクトリに書き出し、DBを更新するが git コミットは行わない。
// 変更したファイルパス一覧と更新済みの Layer を返す。
func (b *Binder) PublishLayerStage(id string) ([]string, *json.Layer, error) {

	var files []string

	m, err := b.GetLayerWithParent(id)
	if err != nil {
		return nil, nil, xerrors.Errorf("GetLayerWithParent() error: %w", err)
	}

	s, err := b.db.PublishStructure(id, b.op)
	if err != nil {
		return nil, nil, xerrors.Errorf("db.PublishStructure() error: %w", err)
	}
	m.ApplyStructure(s.To())

	files = append(files, fs.StructureTableFile())

	var buf strings.Builder
	if err := b.fileSystem.ReadLayer(&buf, id); err != nil {
		return nil, nil, xerrors.Errorf("ReadLayer() error: %w", err)
	}

	svg, err := BuildLayerSVG(buf.String())
	if err != nil {
		return nil, nil, xerrors.Errorf("BuildLayerSVG() error: %w", err)
	}

	fn, err := b.fileSystem.PublishLayer([]byte(svg), m)
	if err != nil {
		return nil, nil, xerrors.Errorf("fs.PublishLayer() error: %w", err)
	}

	files = append(files, fn)

	return files, m, nil
}

func (b *Binder) PublishLayer(id string) (*json.Layer, error) {

	files, m, err := b.PublishLayerStage(id)
	if err != nil {
		return nil, err
	}

	err = b.fileSystem.Commit(fs.M("Publish Layer", m.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return m, nil
}

func (b *Binder) UnpublishLayer(id string) error {

	l, err := b.db.GetLayer(id)
	if err != nil {
		return xerrors.Errorf("db.GetLayer() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	m := l.To()
	m.ApplyStructure(s.To())

	err = b.db.UnpublishStructure(id, b.op)
	if err != nil {
		return xerrors.Errorf("db.UnpublishStructure() error: %w", err)
	}

	fn, err := b.fileSystem.UnpublishLayer(m)
	if err != nil {
		return xerrors.Errorf("fs.UnpublishLayer() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Unpublish Layer", m.Name), fn, fs.StructureTableFile())
	if err != nil && !errors.Is(err, fs.UpdatedFilesError) {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// BuildLayerSVG は shapes JSON 文字列から viewBox="0 0 1 1" の SVG を生成する。
// エディタプレビューと公開SVG書き出しの両方で使用する。
func BuildLayerSVG(shapesJSON string) (string, error) {
	if strings.TrimSpace(shapesJSON) == "" {
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"></svg>`, nil
	}

	var c LayerContent
	if err := jsonenc.Unmarshal([]byte(shapesJSON), &c); err != nil {
		return "", xerrors.Errorf("json.Unmarshal() error: %w", err)
	}

	var b strings.Builder
	b.WriteString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">`)
	for _, s := range c.Shapes {
		fill := s.Fill
		if fill == "" {
			fill = "none"
		}
		color := s.Color
		if color == "" {
			color = "#ff0000"
		}
		sw := s.StrokeWidth
		if sw <= 0 {
			sw = 0.005
		}
		switch s.Type {
		case "line":
			fmt.Fprintf(&b,
				`<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g" stroke-linecap="round"/>`,
				s.X1, s.Y1, s.X2, s.Y2, color, sw)
		case "rect":
			fmt.Fprintf(&b,
				`<rect x="%g" y="%g" width="%g" height="%g" stroke="%s" stroke-width="%g" fill="%s"/>`,
				s.X, s.Y, s.Width, s.Height, color, sw, fill)
		case "ellipse":
			fmt.Fprintf(&b,
				`<ellipse cx="%g" cy="%g" rx="%g" ry="%g" stroke="%s" stroke-width="%g" fill="%s"/>`,
				s.Cx, s.Cy, s.Rx, s.Ry, color, sw, fill)
		}
	}
	b.WriteString(`</svg>`)
	return b.String(), nil
}

// BuildLayerHTML は layer id から画像 + SVG オーバーレイの合成HTMLを返す。
// local=true: エディタプレビュー（インラインSVG + private assetのHTTP URL）
// local=false: 公開（公開済みSVGを <img> で参照）
func (b *Binder) BuildLayerHTML(id string, local bool, imageSrc string) (template.HTML, error) {
	m, err := b.GetLayerWithParent(id)
	if err != nil {
		return "", xerrors.Errorf("GetLayerWithParent() error: %w", err)
	}

	var inner string
	if local {
		var buf strings.Builder
		if err := b.fileSystem.ReadLayer(&buf, id); err != nil {
			return "", xerrors.Errorf("ReadLayer() error: %w", err)
		}
		svg, err := BuildLayerSVG(buf.String())
		if err != nil {
			return "", xerrors.Errorf("BuildLayerSVG() error: %w", err)
		}
		// width/height 100% + absolute でインラインSVGを重ねる
		inner = fmt.Sprintf(
			`<img src="%s" style="display:block;width:100%%;height:auto;"/><div style="position:absolute;inset:0;pointer-events:none;">%s</div>`,
			imageSrc, injectOverlayStyle(svg))
	} else {
		// 公開版: 公開アセットと公開SVGを重ねる
		inner = fmt.Sprintf(
			`<img src="%s" style="display:block;width:100%%;height:auto;"/><img src="%s" style="position:absolute;inset:0;width:100%%;height:100%%;pointer-events:none;"/>`,
			imageSrc, fs.PublicLayerFile(m))
	}

	html := fmt.Sprintf(
		`<div class="binderLayer" id="%s" style="position:relative;display:inline-block;max-width:100%%;">%s</div>`,
		id, inner)
	return template.HTML(html), nil
}

// injectOverlayStyle はインラインSVGに absolute 配置用のスタイルを追加する。
func injectOverlayStyle(svg string) string {
	return strings.Replace(svg,
		`<svg `,
		`<svg style="position:absolute;inset:0;width:100%;height:100%;" `,
		1)
}
