package fs_test

import (
	"binder/fs"
	"fmt"
	"testing"
)

type cryptData struct {
	Name   string
	Detail string
	Val    int
}

func TestCrypt(t *testing.T) {

	var p1 cryptData
	p1.Name = "name"
	p1.Detail = "detail"
	p1.Val = 12

	key := []byte("01234567890123456789012345678901")

	fmt.Println("Key=", len(key))

	c, err := fs.Encrypt(key, &p1)
	if err != nil {
		t.Errorf("Encrypt() error: %v", err)
	}

	fmt.Printf("Data=%x", c)

	var p2 cryptData
	err = fs.Decrypt(key, c, &p2)
	if err != nil {
		t.Errorf("Decrypt() error: %v", err)
	}

	if p1.Name != p2.Name {
		t.Errorf("Name error: %v", p2.Name)
	}

	if p1.Detail != p2.Detail {
		t.Errorf("Detail error: %v", p2.Detail)
	}

	if p1.Val != p2.Val {
		t.Errorf("Val error: %v", p2.Val)
	}

	fmt.Println("P2=", p2)
}
