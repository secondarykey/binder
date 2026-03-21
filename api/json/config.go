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
