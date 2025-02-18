package internal_test

import (
	. "binder/internal"
	"testing"
)

func TestVersion(t *testing.T) {

	v, err := NewVersion("0.0.0")
	if err != nil {
		t.Errorf("NewVersion() error is not nil: %v", err)
	} else if v.String() != "0.0.0" {
		t.Errorf("String() want 0.0.0 got %v", v)
	}

	v, err = NewVersion("0.0")
	if err == nil {
		t.Errorf("NewVersion() parse error is nil 0.0")
	}

	v, err = NewVersion("0.0.0.0")
	if err == nil {
		t.Errorf("NewVersion() parse error is nil 0.0.0.0")
	}

	v, err = NewVersion("0.0.0-PR1")
	if err != nil {
		t.Errorf("NewVersion() PR parse error is nil 0.0.0-PR1: %v", err)
	}
	if !v.IsPR("PR1") {
		t.Errorf("NewVersion() PR parse not PR1")
	}

	v, err = NewVersion("0.0.0+Build2")
	if err != nil {
		t.Errorf("NewVersion() Build parse error is nil 0.0.0+Build2: %v", err)
	}
	if !v.IsBuild("Build2") {
		t.Errorf("NewVersion() Build parse not Build2")
	}

	v, err = NewVersion("0.0.0-PR3+Build4")
	if err != nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0.0.0-PR3+Build4: %v", err)
	}
	if !v.IsPR("PR3") {
		t.Errorf("NewVersion() PR parse not PR3")
	}
	if !v.IsBuild("Build4") {
		t.Errorf("NewVersion() Build parse not Build4")
	}

	v, err = NewVersion("0.0.0+Build5-PR6")
	if err != nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0.0.0+Build5-PR6: %v", err)
	}
	if !v.IsPR("") {
		//逆にした場合にPRのパースはしない
		t.Errorf("NewVersion() PR parse not empty")
	}
	if !v.IsBuild("Build5-PR6") {
		//逆にした場合にPRのパースはしない
		t.Errorf("NewVersion() Build parse not Build5-PR6")
	}

	v, err = NewVersion("0.0.0*PR6")
	if err == nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0.0.0*PR6: %v", err)
	}

	v, err = NewVersion("0a.0.0")
	if err == nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0a.0.0")
	}

	v, err = NewVersion("0.0a.0")
	if err == nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0.0a.0")
	}

	v, err = NewVersion("0.0.0a")
	if err == nil {
		t.Errorf("NewVersion() PR and Build parse error is nil 0.0.0a")
	}

}

func newVer(t *testing.T, buf string) *Version {
	v, err := NewVersion(buf)
	if err != nil {
		t.Fatalf("Version error: %v", err)
	}
	return v
}

func TestCompareCore(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  int
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), -1},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), 0},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), 1},
		{newVer(t, "1.1.0"), newVer(t, "1.2.0"), -1},
		{newVer(t, "10.0.0"), newVer(t, "1.9.8"), 1},
	}
	for _, v := range vers {
		got := v.left.CompareCore(v.right)
		if v.want != got {
			t.Errorf("%v compare(%v) want %d got %d", v.left, v.right, v.want, got)
		}
	}
}

func TestLt(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), true},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), false},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), false},
	}
	for _, v := range vers {
		got := v.left.Lt(v.right)
		if v.want != got {
			t.Errorf("%v less than(%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
}
func TestLe(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), true},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), true},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), false},
	}
	for _, v := range vers {
		got := v.left.Le(v.right)
		if v.want != got {
			t.Errorf("%v less then equal(%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
}
func TestGt(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), false},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), false},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), true},
	}
	for _, v := range vers {
		got := v.left.Gt(v.right)
		if v.want != got {
			t.Errorf("%v greater then (%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
}
func TestGe(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), false},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), true},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), true},
	}
	for _, v := range vers {
		got := v.left.Ge(v.right)
		if v.want != got {
			t.Errorf("%v greater then equal(%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
}

func TestEq(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "1.0.0"), newVer(t, "1.0.1"), false},
		{newVer(t, "1.1.8"), newVer(t, "1.1.8"), true},
		{newVer(t, "2.0.0"), newVer(t, "1.9.9"), false},
	}
	for _, v := range vers {
		got := v.left.Eq(v.right)
		if v.want != got {
			t.Errorf("%v equal (%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
}

func TestPR(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "0.0.0-PR"), newVer(t, "0.0.0"), true},
		{newVer(t, "0.0.0-PR1"), newVer(t, "0.0.0-PR2"), true},
		{newVer(t, "0.0.0-PR3"), newVer(t, "0.0.0-PR2"), false},
		{newVer(t, "0.0.0-PR10"), newVer(t, "0.0.0-PR1"), false},
		{newVer(t, "0.0.0-PR"), newVer(t, "0.0.0-PR1"), true},
	}
	// PR は指定なしの場合は大きくなる
	// 単純なAscii比較な為、10,1 でも数値が大きい順にならない
	for _, v := range vers {
		got := v.left.Le(v.right)
		if v.want != got {
			t.Errorf("%v equal (%v) want %t got %t", v.left, v.right, v.want, got)
		}
	}
	if !newVer(t, "0.0.0-PR").Eq(newVer(t, "0.0.0-PR")) {
		t.Errorf("PR NotEqual")
	}
}

func TestBuild(t *testing.T) {
	vers := []struct {
		left  *Version
		right *Version
		want  bool
	}{
		{newVer(t, "0.0.0+B"), newVer(t, "0.0.0"), false},
		{newVer(t, "0.0.0+B1"), newVer(t, "0.0.0+B2"), true},
		{newVer(t, "0.0.0+B3"), newVer(t, "0.0.0+B2"), false},
		{newVer(t, "0.0.0+B10"), newVer(t, "0.0.0+B1"), false},
		{newVer(t, "0.0.0+B"), newVer(t, "0.0.0+B1"), true},
	}
	// Build は指定なしの場合は小さくなる
	// 単純なAscii比較な為、10,1 でも数値が大きい順にならない
	for _, v := range vers {
		got := v.left.Le(v.right)
		if v.want != got {
			t.Errorf("%+v equal (%+v) want %t got %t", v.left, v.right, v.want, got)
		}
	}

	if !newVer(t, "0.0.0+B0000").Eq(newVer(t, "0.0.0+B0000")) {
		t.Errorf("Build NotEqual")
	}

	if !newVer(t, "0.0.0-PR+B0000").Eq(newVer(t, "0.0.0-PR+B0000")) {
		t.Errorf("PR and Build NotEqual")
	}

}
