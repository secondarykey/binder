package fs_test

import (
	"testing"

	"binder/db/model"
)

func TestCreateAsset(t *testing.T) {

	f := createFileSystem(t, "create_asset")

	var a model.Asset
	a.Id = "asset"
	a.Name = "Test Asset"
	a.Alias = "pub"

	var n model.Note
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
	if f.IsExist("docs/assets/noteAlias/pub") {
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

	if f.IsExist("assets/note/asset") {
		t.Errorf("file status is error(exists)")
	}

	if f.IsExist("docs/assets/noteAlias/pub") {
		t.Errorf("CreateAsset() asset file(publish) is exist")
	}

}
