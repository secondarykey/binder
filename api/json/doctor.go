package json

// DoctorReport はバインダーを開いたときに整合性を修復した内容（binder.DoctorReport の画面向け）。
type DoctorReport struct {
	Items []*DoctorItem `json:"items"`
}

// DoctorItem は修復した 1 件。
//
// Kind:
//   - "orphan"     — 一覧（structures）に無かった実体を index 直下に戻した
//   - "recreated"  — 実体ファイルが無かったので空で作り直した（本文は失われている）
//   - "row"        — 実体テーブルの行が無かったので最小の情報で補った
//   - "reparented" — 親が無かったので index 直下へ移した
type DoctorItem struct {
	Id   string `json:"id"`
	Typ  string `json:"typ"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}
