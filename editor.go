package binder

// GetFullPath はmode(note/diagram等)とidからファイルのフルパスを返す
func (b *Binder) GetFullPath(mode, id string) string {
	return b.fileSystem.ToFullPath(mode, id)
}
