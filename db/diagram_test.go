package db_test

import "testing"

func TestDiagrams(t *testing.T) {

	inst := open()
	d, err := inst.GetDiagram("NotFound")
	if d != nil {
		t.Errorf("GetDiagram() not found is nil")
	}
	if err != nil {
		t.Errorf("db.GetDiagram() not found is nil:%v", err)
	}
}
