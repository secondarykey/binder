package binder

type Plugin interface {
	Name() string
	Version() string
}

type ConvertPlugin interface {
	Convert([]byte) ([]byte, error)
	Plugin
}
