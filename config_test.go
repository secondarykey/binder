package binder_test

import (
	"binder/test"
	"testing"
)

func TestGetConfig(t *testing.T) {
	b := test.CreateBinder(t, "get_config")
	defer b.Close()

	conf, err := b.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error: %v", err)
	}
	if conf == nil {
		t.Fatal("GetConfig() returned nil")
	}
}

func TestEditConfig(t *testing.T) {
	b := test.CreateBinder(t, "edit_config")
	defer b.Close()

	conf, err := b.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() error: %v", err)
	}

	conf.Name = "UpdatedName"
	err = b.EditConfig(conf)
	if err != nil {
		t.Fatalf("EditConfig() error: %v", err)
	}

	conf2, err := b.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig() after edit error: %v", err)
	}
	if conf2.Name != "UpdatedName" {
		t.Errorf("Name after edit = %q, want %q", conf2.Name, "UpdatedName")
	}
}
