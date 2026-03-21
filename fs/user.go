package fs

const (
	UserFileName   = "user_data.enc"
	GitIgnoreFile  = ".gitignore"
)

type UserInfo struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}
