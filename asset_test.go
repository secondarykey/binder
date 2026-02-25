package binder_test

import (
	"testing"

	"binder/db"
	"binder/test"
)

func TestGetAsset(t *testing.T) {
	b := test.CreateBinder(t, "get_asset")
	defer b.Close()
}

func TestEditAsset(t *testing.T) {
	b := test.CreateBinder(t, "edit_asset")
	defer b.Close()
}

func TestRemoveAsset(t *testing.T) {

	b := test.CreateBinder(t, "remove_asset")
	defer b.Close()

	_, err := b.RemoveAsset("Empty_id")
	if err != nil {
		if !db.IsNotExist(err) {
			t.Errorf("RemoveAsset() empty id not error: %v", err)
		}
	}

	db := b.GetDB()
	fs := b.GetFS()
	as, err := db.FindAssets()
	if err != nil {
		t.Fatalf("FindAssets() error: %v", err)
	}

	a := as[0]
	id := a.Id

	a, err = db.GetAsset(id)
	if err != nil {
		t.Errorf("GetAsset() error: %v", err)
	}

	// Structure経由でparentId取得
	s, err := db.GetStructure(id)
	if err != nil {
		t.Fatalf("GetStructure() error: %v", err)
	}

	fn := "assets/" + s.ParentId + "/" + id

	_, err = fs.Stat(fn)
	if err != nil {
		t.Errorf("%s is not exist", fn)
	}

	_, err = b.RemoveAsset(id)
	if err != nil {
		t.Errorf("RemoveAsset() is error: %v", err)
	}

	_, err = fs.Stat(fn)
	if err == nil {
		t.Errorf("%s is exist", fn)
	}
}

func TestGetUnpublishedAssets(t *testing.T) {
	b := test.CreateBinder(t, "get_publishasset")
	defer b.Close()

	all, err := b.GetUnpublishedAssets()
	if err != nil {
		t.Errorf("GetUnpublishedAssets() error: %v", err)
	} else if len(all) != 1 {
		t.Errorf("GetUnpublishedAssets() length want 1 got %d", len(all))
	}

}
