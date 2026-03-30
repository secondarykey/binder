package json

type Config struct {
	Name   string `json:"name"`
	Detail string `json:"detail"`
}

type UserInfo struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	AuthType   string `json:"auth_type"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	Token      string `json:"token"`
	Passphrase string `json:"passphrase"`
	Filename   string `json:"filename"`
	Bytes      []byte `json:"bytes"`
}

type Remote struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type MergeResult struct {
	Status       string          `json:"status"`        // success, uptodate, conflicts, error, reload_error
	Message      string          `json:"message"`
	Address      string          `json:"address"`
	Conflicts    []*ConflictFile `json:"conflicts"`     // status=="conflicts" 時のみ
	BaseHash     string          `json:"base_hash"`
	OursHash     string          `json:"ours_hash"`
	TheirsHash   string          `json:"theirs_hash"`
	AutoResolved int             `json:"auto_resolved"` // 自動解決されたファイル数
}

type ConflictFile struct {
	Path        string `json:"path"`
	Type        string `json:"type"`
	Id          string `json:"id"`
	Name        string `json:"name"`
	OursAction  string `json:"ours_action"`
	TheirAction string `json:"their_action"`
}

type MergeResolution struct {
	BaseHash     string            `json:"base_hash"`
	OursHash     string            `json:"ours_hash"`
	TheirsHash   string            `json:"theirs_hash"`
	RemoteName   string            `json:"remote_name"`
	RemoteBranch string            `json:"remote_branch"`
	Resolutions  []*FileResolution `json:"resolutions"`
}

type FileResolution struct {
	Path       string `json:"path"`
	Resolution string `json:"resolution"` // "ours", "theirs", or "both"
}
