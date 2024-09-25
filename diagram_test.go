package binder_test

import (
	"binder/test"
	"testing"
)

func TestGetDiagram(t *testing.T) {
}

func TestEditDiagram(t *testing.T) {
}

func TestRemoveDiagram(t *testing.T) {
}

func TestOpenDiagram(t *testing.T) {
}

func TestSaveDiagram(t *testing.T) {
}

func TestGetUnpublishedDiagrams(t *testing.T) {
	b := test.CreateBinder(t, "publish_diagrams")

	all, err := b.GetUnpublishedDiagrams()
	if err != nil {
		t.Errorf("GetUnpublishedDiagrams() error: %v", err)
	} else if len(all) != 1 {
		t.Errorf("GetUnpublishedDiagrams() length want 1 got %d", len(all))
	}

	//公開する

	//更新する

	//非公開にする
}
