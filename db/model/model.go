package model

type Status int

const (
	ErrorStatus   Status = -1
	LatestStatus  Status = 0
	PrivateStatus Status = 1
	UpdatedStatus Status = 2

	NothingStatus  Status = 0
	ModifiedStatus Status = 1
)
