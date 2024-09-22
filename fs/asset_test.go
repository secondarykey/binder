package fs_test

import (
	"binder/db/model"
	"testing"
)

func TestCreateAsset(t *testing.T) {

	f := createFileSystem(t, "create_asset")

	var a model.Asset
	a.Id = "asset"
	a.ParentId = "note"
	a.Name = "Test Asset"

	err := f.CreateAsset(&a, []byte("TestData"))
	if err != nil {
		t.Errorf("CreateAsset() error: %v", err)
	}

	_, err = f.Stat("assets/note/asset")
	if err != nil {
		t.Errorf("file status is error: %v", err)
	}

	err = f.DeleteAsset(&a)
	if err != nil {
		t.Errorf("DeleteAsset() error: %v", err)
	}

	_, err = f.Stat("assets/note/asset")
	if err == nil {
		t.Errorf("file status is error(exists)")
	}

}
