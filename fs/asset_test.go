package fs_test

import (
	"testing"
	"time"

	"binder/api/json"
	"binder/fs"
)

func TestCreateAsset(t *testing.T) {

	f := createFileSystem(t, "create_asset")

	var a json.Asset
	a.Id = "asset"
	a.Name = "Test Asset"
	a.Alias = "pub"

	var n json.Note
	n.Id = "note"
	n.Alias = "noteAlias"

	a.ParentId = n.Id
	a.Parent = &n

	fn, err := f.CreateAsset(&a, []byte("TestData"))
	if err != nil {
		t.Errorf("CreateAsset() error: %v", err)
	}

	if !f.IsExist(fn) {
		t.Errorf("CreateAsset() asset file is not exist")
	}
	if f.IsExist("docs/assets/pub") {
		t.Errorf("CreateAsset() asset file(publish) is exist")
	}

	fn, err = f.PublishAsset(&a)
	if err != nil {
		t.Errorf("PublishAsset() is error: %v", err)
	}

	if !f.IsExist(fn) {
		t.Errorf("CreateAsset() asset file(publish) is not exist")
	}

	_, err = f.DeleteAsset(&a)
	if err != nil {
		t.Errorf("DeleteAsset() error: %v", err)
	}

	if f.IsExist("assets/asset") {
		t.Errorf("file status is error(exists)")
	}

	if f.IsExist("docs/assets/pub") {
		t.Errorf("CreateAsset() asset file(publish) is exist")
	}

}

func TestWriteAssetText(t *testing.T) {
	f := createFileSystem(t, "asset_write_text")

	var a json.Asset
	a.Id = "asset-text"
	a.Alias = "asset-alias"

	_, err := f.CreateAsset(&a, []byte("initial"))
	if err != nil {
		t.Fatalf("CreateAsset() error: %v", err)
	}

	if err := f.WriteAssetText(a.Id, []byte("updated content")); err != nil {
		t.Errorf("WriteAssetText() error: %v", err)
	}

	if !f.IsExist(fs.AssetFile(&a)) {
		t.Errorf("WriteAssetText() file not found")
	}
}

func TestUnpublishAsset(t *testing.T) {
	f := createFileSystem(t, "asset_unpublish")

	var a json.Asset
	a.Id = "asset-up"
	a.Alias = "up-alias"

	_, err := f.CreateAsset(&a, []byte("data"))
	if err != nil {
		t.Fatalf("CreateAsset() error: %v", err)
	}

	pub, err := f.PublishAsset(&a)
	if err != nil {
		t.Fatalf("PublishAsset() error: %v", err)
	}
	if !f.IsExist(pub) {
		t.Fatalf("PublishAsset() file not found: %s", pub)
	}

	_, err = f.UnpublishAsset(&a)
	if err != nil {
		t.Errorf("UnpublishAsset() error: %v", err)
	}
	if f.IsExist(pub) {
		t.Errorf("UnpublishAsset() published file still exists: %s", pub)
	}
}

func TestRenamePublishedAsset(t *testing.T) {
	f := createFileSystem(t, "asset_rename")

	var a json.Asset
	a.Id = "asset-ren"
	a.Alias = "old-asset-alias"

	_, err := f.CreateAsset(&a, []byte("rename data"))
	if err != nil {
		t.Fatalf("CreateAsset() error: %v", err)
	}

	_, err = f.PublishAsset(&a)
	if err != nil {
		t.Fatalf("PublishAsset() error: %v", err)
	}

	files, err := f.RenamePublishedAsset("old-asset-alias", "new-asset-alias")
	if err != nil {
		t.Fatalf("RenamePublishedAsset() error: %v", err)
	}
	if len(files) == 0 {
		t.Errorf("RenamePublishedAsset() returned empty file list")
	}
}

func TestRenamePublishedAsset_NotExist(t *testing.T) {
	f := createFileSystem(t, "asset_rename_ne")

	files, err := f.RenamePublishedAsset("no-such", "new-alias")
	if err != nil {
		t.Fatalf("RenamePublishedAsset() unexpected error: %v", err)
	}
	if files != nil {
		t.Errorf("RenamePublishedAsset() expected nil, got %v", files)
	}
}

func TestSetAssetStatus_Private(t *testing.T) {
	f := createFileSystem(t, "asset_status_private")

	var a json.Asset
	a.Id = "asset-st"
	a.Alias = "st-alias"

	_, err := f.CreateAsset(&a, []byte("status data"))
	if err != nil {
		t.Fatalf("CreateAsset() error: %v", err)
	}

	// Republish がゼロ → PublishStatus は PrivateStatus
	a.Republish = time.Time{}
	if err := f.SetAssetStatus(&a); err != nil {
		t.Fatalf("SetAssetStatus() error: %v", err)
	}
	if a.PublishStatus != json.PrivateStatus {
		t.Errorf("PublishStatus: got %d, want PrivateStatus(%d)", a.PublishStatus, json.PrivateStatus)
	}
}

func TestSetAssetStatus_Published(t *testing.T) {
	f := createFileSystem(t, "asset_status_pub")

	var a json.Asset
	a.Id = "asset-st2"
	a.Alias = "st2-alias"

	fn, err := f.CreateAsset(&a, []byte("pub status data"))
	if err != nil {
		t.Fatalf("CreateAsset() error: %v", err)
	}

	// コミットして clean な状態にする
	if err := f.AutoCommit("test", fn); err != nil {
		t.Fatalf("AutoCommit() error: %v", err)
	}

	// Republish を未来に設定 → LatestStatus
	a.Republish = time.Now().Add(time.Hour)
	if err := f.SetAssetStatus(&a); err != nil {
		t.Fatalf("SetAssetStatus() error: %v", err)
	}
	if a.PublishStatus != json.LatestStatus {
		t.Errorf("PublishStatus: got %d, want LatestStatus(%d)", a.PublishStatus, json.LatestStatus)
	}
}
