package fs_test

import (
	"bytes"
	"testing"

	"binder/entity"
	"binder/fs"
)

func newTemplate(id, typ string) *entity.Template {
	return &entity.Template{Id: id, Typ: typ}
}

func TestAddTemplateFrame_Layout(t *testing.T) {
	data := []byte("<p>layout</p>")
	got := fs.AddTemplateFrame(entity.LayoutTemplateType, data)
	if !bytes.Contains(got, []byte(`{{ define "Pages" }}`)) {
		t.Errorf("AddTemplateFrame(layout) missing define frame: %s", got)
	}
	if !bytes.Contains(got, []byte("{{ end }}")) {
		t.Errorf("AddTemplateFrame(layout) missing end frame: %s", got)
	}
	if !bytes.Contains(got, data) {
		t.Errorf("AddTemplateFrame(layout) missing original content")
	}
}

func TestAddTemplateFrame_Content(t *testing.T) {
	data := []byte("<p>content</p>")
	got := fs.AddTemplateFrame(entity.ContentTemplateType, data)
	if !bytes.Contains(got, []byte(`{{ define "Content" }}`)) {
		t.Errorf("AddTemplateFrame(content) missing define frame: %s", got)
	}
}

func TestAddTemplateFrame_Diagram(t *testing.T) {
	data := []byte("graph TD; A-->B")
	got := fs.AddTemplateFrame(entity.DiagramTemplateType, data)
	// diagram は HTML ではないのでフレームなしのまま返る
	if !bytes.Equal(got, data) {
		t.Errorf("AddTemplateFrame(diagram) should return data unchanged, got: %s", got)
	}
}

func TestStripTemplateFrame_Layout(t *testing.T) {
	data := []byte("<p>layout</p>")
	framed := fs.AddTemplateFrame(entity.LayoutTemplateType, data)
	got := fs.StripTemplateFrame(entity.LayoutTemplateType, framed)
	if !bytes.Equal(got, data) {
		t.Errorf("StripTemplateFrame(layout) got %q, want %q", got, data)
	}
}

func TestStripTemplateFrame_Content(t *testing.T) {
	data := []byte("<p>content</p>")
	framed := fs.AddTemplateFrame(entity.ContentTemplateType, data)
	got := fs.StripTemplateFrame(entity.ContentTemplateType, framed)
	if !bytes.Equal(got, data) {
		t.Errorf("StripTemplateFrame(content) got %q, want %q", got, data)
	}
}

func TestStripTemplateFrame_NoFrame(t *testing.T) {
	data := []byte("<p>no frame</p>")
	got := fs.StripTemplateFrame(entity.LayoutTemplateType, data)
	if !bytes.Equal(got, data) {
		t.Errorf("StripTemplateFrame(no frame) should return data unchanged, got: %s", got)
	}
}

func TestCreateTemplateFile(t *testing.T) {
	f := createFileSystem(t, "tmpl_create")

	tmpl := newTemplate("tmpl1", string(entity.ContentTemplateType))
	fn, err := f.CreateTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("CreateTemplateFile() error: %v", err)
	}
	if !f.IsExist(fn) {
		t.Errorf("CreateTemplateFile() file not found: %s", fn)
	}
}

func TestWriteAndReadTemplate(t *testing.T) {
	f := createFileSystem(t, "tmpl_rw")

	tmpl := newTemplate("tmpl2", string(entity.LayoutTemplateType))
	_, err := f.CreateTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("CreateTemplateFile() error: %v", err)
	}

	content := []byte("<html>{{template \"Content\" .}}</html>")
	if _, err := f.WriteTemplate(tmpl, content); err != nil {
		t.Fatalf("WriteTemplate() error: %v", err)
	}

	var buf bytes.Buffer
	if err := f.ReadTemplate(&buf, tmpl); err != nil {
		t.Fatalf("ReadTemplate() error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), content) {
		t.Errorf("ReadTemplate() got %q, want %q", buf.String(), string(content))
	}
}

func TestDeleteTemplateFile(t *testing.T) {
	f := createFileSystem(t, "tmpl_delete")

	tmpl := newTemplate("tmpl3", string(entity.ContentTemplateType))
	fn, err := f.CreateTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("CreateTemplateFile() error: %v", err)
	}

	files, err := f.DeleteTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("DeleteTemplateFile() error: %v", err)
	}
	if f.IsExist(fn) {
		t.Errorf("DeleteTemplateFile() file still exists: %s", fn)
	}
	if len(files) == 0 {
		t.Errorf("DeleteTemplateFile() returned empty file list")
	}
}

func TestDeleteTemplateFile_NotExist(t *testing.T) {
	f := createFileSystem(t, "tmpl_delete_ne")

	tmpl := newTemplate("ghost-tmpl", string(entity.ContentTemplateType))
	_, err := f.DeleteTemplateFile(tmpl)
	if err == nil {
		t.Errorf("DeleteTemplateFile() expected error for nonexistent template, got nil")
	}
}

func TestSetTemplateStatus_Uncommitted(t *testing.T) {
	f := createFileSystem(t, "tmpl_status_new")

	tmpl := newTemplate("tmpl-st1", string(entity.ContentTemplateType))
	_, err := f.CreateTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("CreateTemplateFile() error: %v", err)
	}

	// 未コミット → git status に出るので UpdatedStatus
	if err := f.SetTemplateStatus(tmpl); err != nil {
		t.Fatalf("SetTemplateStatus() error: %v", err)
	}
	if tmpl.UpdatedStatus != entity.UpdatedStatus {
		t.Errorf("UpdatedStatus: got %d, want UpdatedStatus(%d)", tmpl.UpdatedStatus, entity.UpdatedStatus)
	}
}

func TestSetTemplateStatus_Committed(t *testing.T) {
	f := createFileSystem(t, "tmpl_status_committed")

	tmpl := newTemplate("tmpl-st2", string(entity.LayoutTemplateType))
	fn, err := f.CreateTemplateFile(tmpl)
	if err != nil {
		t.Fatalf("CreateTemplateFile() error: %v", err)
	}

	if err := f.AutoCommit("test", fn); err != nil {
		t.Fatalf("AutoCommit() error: %v", err)
	}

	// コミット済み → git status に出ない → NothingStatus
	if err := f.SetTemplateStatus(tmpl); err != nil {
		t.Fatalf("SetTemplateStatus() error: %v", err)
	}
	if tmpl.UpdatedStatus != entity.NothingStatus {
		t.Errorf("UpdatedStatus: got %d, want NothingStatus(%d)", tmpl.UpdatedStatus, entity.NothingStatus)
	}
}

