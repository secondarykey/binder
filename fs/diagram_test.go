package fs_test

import (
	"bytes"
	"testing"
	"time"

	"binder/api/json"
)

func newDiagram(id, alias string) *json.Diagram {
	d := &json.Diagram{}
	d.Id = id
	d.Alias = alias
	return d
}

func TestCreateDiagramFile(t *testing.T) {
	f := createFileSystem(t, "diagram_create")

	d := newDiagram("diag1", "diag-alias")
	fn, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}
	if !f.IsExist(fn) {
		t.Errorf("CreateDiagramFile() file not found: %s", fn)
	}
}

func TestWriteAndReadDiagram(t *testing.T) {
	f := createFileSystem(t, "diagram_rw")

	d := newDiagram("diag2", "diag-alias2")
	_, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	content := []byte("graph TD\n  A --> B")
	if err := f.WriteDiagram(d.Id, content); err != nil {
		t.Fatalf("WriteDiagram() error: %v", err)
	}

	var buf bytes.Buffer
	if err := f.ReadDiagram(&buf, d.Id); err != nil {
		t.Fatalf("ReadDiagram() error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), content) {
		t.Errorf("ReadDiagram() got %q, want %q", buf.String(), string(content))
	}
}

func TestDeleteDiagram(t *testing.T) {
	f := createFileSystem(t, "diagram_delete")

	d := newDiagram("diag3", "diag-alias3")
	fn, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	files, err := f.DeleteDiagram(d)
	if err != nil {
		t.Fatalf("DeleteDiagram() error: %v", err)
	}
	if f.IsExist(fn) {
		t.Errorf("DeleteDiagram() file still exists: %s", fn)
	}
	if len(files) == 0 {
		t.Errorf("DeleteDiagram() returned empty file list")
	}
}

func TestDeleteDiagram_NotExist(t *testing.T) {
	f := createFileSystem(t, "diagram_delete_ne")

	d := newDiagram("ghost-diag", "ghost-alias")
	_, err := f.DeleteDiagram(d)
	if err == nil {
		t.Errorf("DeleteDiagram() expected error for nonexistent diagram, got nil")
	}
}

func TestPublishAndUnpublishDiagram(t *testing.T) {
	f := createFileSystem(t, "diagram_publish")

	d := newDiagram("diag4", "pub-diag-alias")
	_, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	svgData := []byte("<svg>...</svg>")
	pub, err := f.PublishDiagram(svgData, d)
	if err != nil {
		t.Fatalf("PublishDiagram() error: %v", err)
	}
	if !f.IsExist(pub) {
		t.Errorf("PublishDiagram() published file not found: %s", pub)
	}

	_, err = f.UnpublishDiagram(d)
	if err != nil {
		t.Fatalf("UnpublishDiagram() error: %v", err)
	}
	if f.IsExist(pub) {
		t.Errorf("UnpublishDiagram() published file still exists: %s", pub)
	}
}

func TestRenamePublishedDiagram(t *testing.T) {
	f := createFileSystem(t, "diagram_rename")

	d := newDiagram("diag5", "old-diag-alias")
	_, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	_, err = f.PublishDiagram([]byte("<svg>data</svg>"), d)
	if err != nil {
		t.Fatalf("PublishDiagram() error: %v", err)
	}

	files, err := f.RenamePublishedDiagram("old-diag-alias", "new-diag-alias")
	if err != nil {
		t.Fatalf("RenamePublishedDiagram() error: %v", err)
	}
	if len(files) == 0 {
		t.Errorf("RenamePublishedDiagram() returned empty file list")
	}
}

func TestRenamePublishedDiagram_NotExist(t *testing.T) {
	f := createFileSystem(t, "diagram_rename_ne")

	files, err := f.RenamePublishedDiagram("no-such-alias", "new-alias")
	if err != nil {
		t.Fatalf("RenamePublishedDiagram() unexpected error: %v", err)
	}
	if files != nil {
		t.Errorf("RenamePublishedDiagram() expected nil for nonexistent file, got %v", files)
	}
}

func TestSetDiagramStatus_Private(t *testing.T) {
	f := createFileSystem(t, "diag_status_private")

	d := newDiagram("diag-st1", "st-diag-alias1")
	_, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	// Republish がゼロ → PublishStatus は PrivateStatus
	d.Republish = time.Time{}
	if err := f.SetDiagramStatus(d); err != nil {
		t.Fatalf("SetDiagramStatus() error: %v", err)
	}
	if d.PublishStatus != json.PrivateStatus {
		t.Errorf("PublishStatus: got %d, want PrivateStatus(%d)", d.PublishStatus, json.PrivateStatus)
	}
}

func TestSetDiagramStatus_Published(t *testing.T) {
	f := createFileSystem(t, "diag_status_pub")

	d := newDiagram("diag-st2", "st-diag-alias2")
	fn, err := f.CreateDiagramFile(d)
	if err != nil {
		t.Fatalf("CreateDiagramFile() error: %v", err)
	}

	if err := f.AutoCommit("test", fn); err != nil {
		t.Fatalf("AutoCommit() error: %v", err)
	}

	// Republish を未来に設定 → LatestStatus
	d.Republish = time.Now().Add(time.Hour)
	if err := f.SetDiagramStatus(d); err != nil {
		t.Fatalf("SetDiagramStatus() error: %v", err)
	}
	if d.PublishStatus != json.LatestStatus {
		t.Errorf("PublishStatus: got %d, want LatestStatus(%d)", d.PublishStatus, json.LatestStatus)
	}
}
