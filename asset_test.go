package binder_test

import (
	"fmt"
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
	as, err := db.FindAssets()
	if err != nil {
		t.Fatalf("FindAssets() error: %v", err)
	}
	a := as[0]

	fmt.Println(a)
}
