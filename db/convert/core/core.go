package core

type Converter func(string, []*FileSet) ([]*FileSet, error)

type FileSet struct {
	Dst string
	Org string
}

func NewFileSet(org string) *FileSet {
	var fs FileSet
	fs.Org = org
	fs.Dst = org
	return &fs
}

func (fs *FileSet) This(f string) bool {
	if fs.Org == f {
		return true
	}
	return false
}

func (fs *FileSet) IsChange() bool {
	if fs.Org != fs.Dst {
		return true
	}
	return false
}
