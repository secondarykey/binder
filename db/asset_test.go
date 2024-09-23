package db_test

import "testing"

func TestFindAssetWithParent(t *testing.T) {
	inst := open()
	defer inst.Close()

	all, err := inst.FindAssetWithParent()
	if err != nil {
		t.Errorf("inst.FindAssetWithParent() error: %v", err)
	}

	if len(all) != 0 {
		t.Errorf("inst.FindAssetWithParent() is not zero: %d", len(all))
	}

}
