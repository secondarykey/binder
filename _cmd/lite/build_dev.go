//go:build !production

package main

// isDev は開発中（wails3 dev・go run）か。wails3 build は -tags production を付け、wails3 dev は付けない。
const isDev = true
