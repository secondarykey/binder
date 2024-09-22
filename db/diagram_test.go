package db_test

import (
	"binder/db"
	"testing"
)

func TestDiagrams(t *testing.T) {

	inst := open()
	_, err := inst.GetDiagram("NotFound")
	if err != nil {
		if !db.IsNotExist(err) {
			t.Errorf("GetDiagram() is not error: %v", err)
		}
	}
}
