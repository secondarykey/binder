package fs_test

import (
	"bytes"
	"testing"
	"time"

	"binder/api/json"
)

func newNote(id, alias string) *json.Note {
	n := &json.Note{}
	n.Id = id
	n.Alias = alias
	return n
}

func TestCreateNoteFile(t *testing.T) {
	f := createFileSystem(t, "note_create")

	n := newNote("note1", "note-alias")
	fn, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}
	if !f.IsExist(fn) {
		t.Errorf("CreateNoteFile() file not found: %s", fn)
	}
}

func TestWriteAndReadNoteText(t *testing.T) {
	f := createFileSystem(t, "note_rw")

	n := newNote("note2", "note-alias2")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	content := []byte("# Hello\n\nTest content.")
	if err := f.WriteNoteText(n.Id, content); err != nil {
		t.Fatalf("WriteNoteText() error: %v", err)
	}

	var buf bytes.Buffer
	if err := f.ReadNoteText(&buf, n.Id); err != nil {
		t.Fatalf("ReadNoteText() error: %v", err)
	}
	if !bytes.Equal(buf.Bytes(), content) {
		t.Errorf("ReadNoteText() got %q, want %q", buf.String(), string(content))
	}
}

func TestDeleteNote(t *testing.T) {
	f := createFileSystem(t, "note_delete")

	n := newNote("note3", "note-alias3")
	fn, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	files, err := f.DeleteNote(n)
	if err != nil {
		t.Fatalf("DeleteNote() error: %v", err)
	}
	if f.IsExist(fn) {
		t.Errorf("DeleteNote() file still exists: %s", fn)
	}
	if len(files) == 0 {
		t.Errorf("DeleteNote() returned empty file list")
	}
}

func TestDeleteNote_NotExist(t *testing.T) {
	f := createFileSystem(t, "note_delete_ne")

	n := newNote("ghost", "ghost-alias")
	_, err := f.DeleteNote(n)
	if err == nil {
		t.Errorf("DeleteNote() expected error for nonexistent note, got nil")
	}
}

func TestPublishAndUnpublishNote(t *testing.T) {
	f := createFileSystem(t, "note_publish")

	n := newNote("note4", "pub-alias")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	html := []byte("<html><body>Hello</body></html>")
	pub, err := f.PublishNote(html, n)
	if err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}
	if !f.IsExist(pub) {
		t.Errorf("PublishNote() published file not found: %s", pub)
	}

	_, err = f.UnpublishNote(n)
	if err != nil {
		t.Fatalf("UnpublishNote() error: %v", err)
	}
	if f.IsExist(pub) {
		t.Errorf("UnpublishNote() published file still exists: %s", pub)
	}
}

func TestWriteMetaDataAndDeleteMetaFile(t *testing.T) {
	f := createFileSystem(t, "note_meta")

	n := newNote("note5", "meta-alias")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	mf, err := f.WriteMetaData(n, []byte("fake-image-bytes"))
	if err != nil {
		t.Fatalf("WriteMetaData() error: %v", err)
	}
	if !f.IsExist(mf) {
		t.Errorf("WriteMetaData() meta file not found: %s", mf)
	}

	_, deleted := f.DeleteMetaFile(n)
	if !deleted {
		t.Errorf("DeleteMetaFile() expected deleted=true")
	}
	if f.IsExist(mf) {
		t.Errorf("DeleteMetaFile() meta file still exists: %s", mf)
	}
}

func TestDeleteMetaFile_NotExist(t *testing.T) {
	f := createFileSystem(t, "note_meta_ne")

	n := newNote("ghost2", "ghost-alias2")
	_, deleted := f.DeleteMetaFile(n)
	if deleted {
		t.Errorf("DeleteMetaFile() expected deleted=false for nonexistent file")
	}
}

func TestPublishNoteMetaAndUnpublishNoteMeta(t *testing.T) {
	f := createFileSystem(t, "note_pubmeta")

	n := newNote("note6", "pub-meta-alias")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	pub, err := f.PublishNoteMeta([]byte("meta-image-bytes"), n)
	if err != nil {
		t.Fatalf("PublishNoteMeta() error: %v", err)
	}
	if !f.IsExist(pub) {
		t.Errorf("PublishNoteMeta() file not found: %s", pub)
	}

	_, deleted := f.UnpublishNoteMeta(n)
	if !deleted {
		t.Errorf("UnpublishNoteMeta() expected deleted=true")
	}
	if f.IsExist(pub) {
		t.Errorf("UnpublishNoteMeta() file still exists: %s", pub)
	}
}

func TestUnpublishNoteMeta_NotExist(t *testing.T) {
	f := createFileSystem(t, "note_unpubmeta_ne")

	n := newNote("ghost3", "ghost-alias3")
	_, deleted := f.UnpublishNoteMeta(n)
	if deleted {
		t.Errorf("UnpublishNoteMeta() expected deleted=false for nonexistent file")
	}
}

func TestRenamePublishedNote(t *testing.T) {
	f := createFileSystem(t, "note_rename")

	n := newNote("note7", "old-alias")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	_, err = f.PublishNote([]byte("<html>Renamed</html>"), n)
	if err != nil {
		t.Fatalf("PublishNote() error: %v", err)
	}

	files, err := f.RenamePublishedNote("old-alias", "new-alias")
	if err != nil {
		t.Fatalf("RenamePublishedNote() error: %v", err)
	}
	if len(files) == 0 {
		t.Errorf("RenamePublishedNote() returned empty file list")
	}
}

func TestRenamePublishedNote_NotExist(t *testing.T) {
	f := createFileSystem(t, "note_rename_ne")

	files, err := f.RenamePublishedNote("no-such-alias", "new-alias")
	if err != nil {
		t.Fatalf("RenamePublishedNote() unexpected error: %v", err)
	}
	if len(files) != 0 {
		t.Errorf("RenamePublishedNote() expected empty list, got %v", files)
	}
}

func TestSetNoteStatus_Private(t *testing.T) {
	f := createFileSystem(t, "note_status_private")

	n := newNote("note-st1", "st-alias1")
	_, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	// Republish がゼロ → PublishStatus は PrivateStatus
	n.Republish = time.Time{}
	if err := f.SetNoteStatus(n); err != nil {
		t.Fatalf("SetNoteStatus() error: %v", err)
	}
	if n.PublishStatus != json.PrivateStatus {
		t.Errorf("PublishStatus: got %d, want PrivateStatus(%d)", n.PublishStatus, json.PrivateStatus)
	}
}

func TestSetNoteStatus_Published(t *testing.T) {
	f := createFileSystem(t, "note_status_pub")

	n := newNote("note-st2", "st-alias2")
	fn, err := f.CreateNoteFile(n)
	if err != nil {
		t.Fatalf("CreateNoteFile() error: %v", err)
	}

	if err := f.AutoCommit("test", fn); err != nil {
		t.Fatalf("AutoCommit() error: %v", err)
	}

	// Republish を未来に設定 → LatestStatus
	n.Republish = time.Now().Add(time.Hour)
	if err := f.SetNoteStatus(n); err != nil {
		t.Fatalf("SetNoteStatus() error: %v", err)
	}
	if n.PublishStatus != json.LatestStatus {
		t.Errorf("PublishStatus: got %d, want LatestStatus(%d)", n.PublishStatus, json.LatestStatus)
	}
}
