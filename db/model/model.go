package model

type Status int

const (
	LatestStatus Status = iota
	PrivateStatus
	UpdatedStatus
)
