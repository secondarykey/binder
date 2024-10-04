package binder

import (
	"binder/fs"
	"fmt"
	"io"

	"golang.org/x/xerrors"
)

func (b *Binder) getFilename(typ, id string) (string, error) {
	fn := ""
	switch typ {
	case "note":
		fn = fs.NoteFile(id)
	case "diagram":
		fn = fs.DiagramFile(id)
	case "asset":
		a, err := b.db.GetAssetWithParent(id)
		if err != nil {
			return "", xerrors.Errorf("GetAssetWithParent() error: %w", err)
		}
		fn = fs.AssetFile(a)
	case "template":
		fn = fs.TemplateFile(id)
	default:
		return "", fmt.Errorf("Not Found Type: %s", typ)
	}

	return fn, nil
}

func (b *Binder) WriteLatestPatch(w io.Writer, typ string, id string) error {

	fn, err := b.getFilename(typ, id)
	if err != nil {
		return xerrors.Errorf("getFilename() error: %w", err)
	}

	err = b.fileSystem.WriteFilePatch(w, fn)
	if err != nil {
		return xerrors.Errorf("WriteFilePatch() error: %w", err)
	}

	return nil
}
