package model_test

import (
	"binder/db/model"
	"testing"
)

func TestStatus(t *testing.T) {
	s := model.Structure{
		Id:       "test-id",
		ParentId: "parent-id",
		Seq:      1,
		Typ:      "note",
		Name:     "Test Structure",
		Detail:   "A test structure",
	}

	if s.Id != "test-id" {
		t.Errorf("Structure.Id = %q, want %q", s.Id, "test-id")
	}
	if s.ParentId != "parent-id" {
		t.Errorf("Structure.ParentId = %q, want %q", s.ParentId, "parent-id")
	}
	if s.Typ != "note" {
		t.Errorf("Structure.Typ = %q, want %q", s.Typ, "note")
	}
	if s.Name != "Test Structure" {
		t.Errorf("Structure.Name = %q, want %q", s.Name, "Test Structure")
	}

	// Test To() conversion
	js := s.To()
	if js.Id != s.Id {
		t.Errorf("To().Id = %q, want %q", js.Id, s.Id)
	}
	if js.Name != s.Name {
		t.Errorf("To().Name = %q, want %q", js.Name, s.Name)
	}
	if js.Typ != s.Typ {
		t.Errorf("To().Typ = %q, want %q", js.Typ, s.Typ)
	}
}
