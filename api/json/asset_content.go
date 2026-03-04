package json

// AssetContent はアセットのメタデータとファイル内容を合わせた型。
// GetAssetContent() API で返却される。Content は常に base64 エンコードされた文字列。
type AssetContent struct {
	Id      string `json:"id"`
	Name    string `json:"name"`
	Binary  bool   `json:"binary"`
	Content string `json:"content"` // base64 encoded
}
