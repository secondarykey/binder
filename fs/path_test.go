package fs_test

import (
	"binder/api/json"
	"binder/fs"
	"testing"
)

func TestToGitBash(t *testing.T) {
	var vals = []struct {
		path string
		want string
	}{
		{"C:\\test\\test", "/C/test/test"},
		{"C:\\test\\test.test", "/C/test/test.test"},
	}
	for _, v := range vals {
		got := fs.ToGitBash(v.path)
		if v.want != got {
			t.Errorf("ToGitBash(): want %s ,got %s", v.want, got)
		}
	}

}

func TestHTMLFile(t *testing.T) {
	var n json.Note

	var vals = []struct {
		id    string
		alias string
		want  string
	}{
		{"index", "alias", "docs\\index.html"},
		{"", "alias", "docs\\pages\\alias.html"},
		{"aaa", "alias2", "docs\\pages\\alias2.html"},
	}

	for _, v := range vals {
		n.Id = v.id
		n.Alias = v.alias

		got := fs.HTMLFile(&n)
		if v.want != got {
			t.Errorf("%s,%s %s != %s error", n.Id, n.Alias, v.want, got)
		}
	}
}

func TestSVGFile(t *testing.T) {
	var d json.Diagram

	var vals = []struct {
		id    string
		alias string
		want  string
	}{
		{"index", "alias", "docs\\images\\alias.svg"},
		{"test", "alias_x", "docs\\images\\alias_x.svg"},
	}

	for _, v := range vals {
		d.Id = v.id
		d.Alias = v.alias

		got := fs.SVGFile(&d)
		if v.want != got {
			t.Errorf("%s %s != %s error", d.Alias, v.want, got)
		}
	}
}

func TestPublicMetaFile(t *testing.T) {
	var n json.Note

	var vals = []struct {
		id    string
		alias string
		want  string
	}{
		{"index", "alias", "docs\\images\\meta\\alias"},
		{"test", "alias_x", "docs\\images\\meta\\alias_x"},
	}

	for _, v := range vals {
		n.Id = v.id
		n.Alias = v.alias
		got := fs.PublicMetaFile(&n)
		if v.want != got {
			t.Errorf("%s %s != %s error", n.Alias, v.want, got)
		}
	}
}

func TestPublicAssetFile(t *testing.T) {

	var n json.Note
	var a json.Asset

	// アセットパスはフラット化され、aliasのみで決まる（親ノードのaliasは不要）
	var vals = []struct {
		n_alias string
		a_alias string
		want    string
	}{
		{"index", "alias", "docs\\assets\\alias"},
		{"test", "alias_x", "docs\\assets\\alias_x"},
		{"test", "", ""},
	}

	for _, v := range vals {
		n.Alias = v.n_alias
		a.SetParent(&n)
		a.Alias = v.a_alias

		got := fs.PublicAssetFile(&a)
		if v.want != got {
			t.Errorf("%s %s != %s error", n.Alias, v.want, got)
		}
	}
}

func TestNoteFile(t *testing.T) {

	var vals = []struct {
		id   string
		want string
	}{
		{"index", "notes\\index.md"},
		{"test", "notes\\test.md"},
	}

	for _, v := range vals {
		got := fs.NoteFile(v.id)
		if v.want != got {
			t.Errorf("%s %s != %s error", v.id, v.want, got)
		}
	}
}

func TestDiagramFile(t *testing.T) {

	var vals = []struct {
		id   string
		want string
	}{
		{"index", "diagrams\\index.md"},
		{"test", "diagrams\\test.md"},
	}

	for _, v := range vals {
		got := fs.DiagramFile(v.id)
		if v.want != got {
			t.Errorf("%s %s != %s error", v.id, v.want, got)
		}
	}
}

func TestMetaFile(t *testing.T) {

	var n json.Note
	var vals = []struct {
		id   string
		want string
	}{
		{"index", "assets\\meta\\index"},
		{"test", "assets\\meta\\test"},
	}

	for _, v := range vals {
		n.Id = v.id
		got := fs.MetaFile(&n)
		if v.want != got {
			t.Errorf("%s %s != %s error", v.id, v.want, got)
		}
	}
}

func TestAssetFile(t *testing.T) {

	var a json.Asset
	// アセットパスはフラット化され、a.Idのみで決まる（親ノードのIDは不要）
	var vals = []struct {
		id   string
		want string
	}{
		{"test.data", "assets\\test.data"},
		{"aaa", "assets\\aaa"},
		{"", ""},
	}

	for _, v := range vals {
		a.Id = v.id

		got := fs.AssetFile(&a)
		if v.want != got {
			t.Errorf("%s %s != %s error", v.id, v.want, got)
		}
	}
}

func TestTemplateFile(t *testing.T) {

	//どっちもID
	var vals = []struct {
		id   string
		want string
	}{
		{"index", "templates\\index.tmpl"},
		{"test", "templates\\test.tmpl"},
	}

	for _, v := range vals {
		got := fs.TemplateFile(v.id)
		if v.want != got {
			t.Errorf("%s %s != %s error", v.id, v.want, got)
		}
	}
}
