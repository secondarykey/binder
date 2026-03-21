package fs

const (
	UserFileName = "user_data.enc"
)

type UserInfo struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}
