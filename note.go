package binder

import (
	"binder/api/json"
	"binder/db/model"
	"binder/fs"
	"errors"
	"io"

	"golang.org/x/xerrors"
)

func (b *Binder) GetNote(id string) (*json.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	rtn := n.To()

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}
	rtn.ApplyStructure(s.To())

	err = b.fileSystem.SetNoteStatus(rtn)
	if err != nil {
		return nil, xerrors.Errorf("fs.SetNoteStatus() error: %w", err)
	}
	return rtn, nil
}

func (b *Binder) RemoveNote(id string) (*json.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	// index ノートは削除不可
	if id == "index" {
		return nil, xerrors.Errorf("index note cannot be deleted")
	}

	// 子要素が存在する場合は削除不可
	children, err := b.db.FindStructuresByParent(id)
	if err != nil {
		return nil, xerrors.Errorf("db.FindStructuresByParent() error: %w", err)
	}
	if len(children) > 0 {
		return nil, xerrors.Errorf("note has children and cannot be deleted: %s", id)
	}

	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	j := n.To()
	j.ApplyStructure(s.To())

	//TODO 親に持つオブジェクトをすべて取得
	//ファイルを削除
	files, err := b.fileSystem.DeleteNote(j)
	if err != nil {
		return nil, xerrors.Errorf("fs.DeleteNote() error: %w", err)
	}

	//DBを削除
	err = b.db.DeleteNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteNote() error: %w", err)
	}

	err = b.db.DeleteStructure(id)
	if err != nil {
		return nil, xerrors.Errorf("db.DeleteStructure() error: %w", err)
	}

	files = append(files, fs.NoteTableFile(), fs.StructureTableFile())

	//コミット
	err = b.fileSystem.Commit(fs.M("Remove Note", j.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return j, nil
}

func (b *Binder) EditNote(n *json.Note, metaName string) (*json.Note, error) {

	if b == nil {
		return nil, EmptyError
	}

	var prefix string
	var files []string

	if n.Id == "" {

		n.Id = b.generateId()
		n.Alias = n.Id

		// LayoutTemplateが未指定の場合、seqが最小のlayoutテンプレートをデフォルトとして設定する
		if n.LayoutTemplate == "" {
			lt, err := b.db.FindDefaultLayoutTemplate()
			if err != nil {
				return nil, xerrors.Errorf("db.FindDefaultLayoutTemplate() error: %w", err)
			}
			if lt != nil {
				n.LayoutTemplate = lt.Id
			}
		}

		// ContentTemplateが未指定の場合、seqが最小のcontentテンプレートをデフォルトとして設定する
		if n.ContentTemplate == "" {
			dt, err := b.db.FindDefaultContentTemplate()
			if err != nil {
				return nil, xerrors.Errorf("db.FindDefaultContentTemplate() error: %w", err)
			}
			if dt != nil {
				n.ContentTemplate = dt.Id
			}
		}

		fn, err := b.createNote(n)

		if err != nil {
			return nil, xerrors.Errorf("createNote() error: %w", err)
		}

		files = append(files, fn)

		// Structure作成
		err = b.createStructure(n.Id, n.ParentId, "note", n.Name, n.Detail, n.Alias)
		if err != nil {
			return nil, xerrors.Errorf("createStructure() error: %w", err)
		}

		prefix = "Create Note"

	} else {

		_, err := b.db.GetNote(n.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetNote() error: %w", err)
		}

		// alias変更時に公開済みファイルをリネーム
		oldS, err := b.db.GetStructure(n.Id)
		if err != nil {
			return nil, xerrors.Errorf("db.GetStructure() error: %w", err)
		}
		if oldS.Alias != n.Alias {
			renamedFiles, err := b.fileSystem.RenamePublishedNote(oldS.Alias, n.Alias)
			if err != nil {
				return nil, xerrors.Errorf("fs.RenamePublishedNote() error: %w", err)
			}
			files = append(files, renamedFiles...)
		}

		m := model.ConvertNote(n)
		err = b.db.UpdateNote(m, b.op)
		if err != nil {
			return nil, xerrors.Errorf("db.UpdateNote() error: %w", err)
		}

		// Structure更新
		err = b.updateStructure(n.Id, n.ParentId, n.Name, n.Detail, n.Alias)
		if err != nil {
			return nil, xerrors.Errorf("updateStructure() error: %w", err)
		}

		prefix = "Update Note"
	}

	//メタデータ指定がある場合
	if metaName != "" {
		meta, err := b.fileSystem.EditMetadata(n, metaName)
		if err != nil {
			return nil, xerrors.Errorf("fs.EditMetadata() error: %w", err)
		}

		files = append(files, meta)
	}

	files = append(files, fs.NoteTableFile(), fs.StructureTableFile())
	//コミット
	err := b.fileSystem.Commit(fs.M(prefix, n.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return n, nil
}

// ノートの作成を行う
func (b *Binder) createNote(n *json.Note) (string, error) {

	fn, err := b.fileSystem.CreateNoteFile(n)
	if err != nil {
		return "", xerrors.Errorf("fs.CreateNoteFile() error: %w", err)
	}

	m := model.ConvertNote(n)
	err = b.db.InsertNote(m, b.op)
	if err != nil {
		return "", xerrors.Errorf("db.InsertNote() error: %w", err)
	}
	return fn, nil
}

func (b *Binder) ReadNote(w io.Writer, noteId string) error {

	if b == nil {
		return EmptyError
	}

	err := b.fileSystem.ReadNoteText(w, noteId)
	if err != nil {
		return xerrors.Errorf("fs.ReadNoteText() error: %w", err)
	}
	return nil
}

// ReadMetaBytes はノートのメタ画像ファイル（assets/meta/{noteId}）をバイト列で返す。
// ファイルが存在しない場合は nil を返す。
func (b *Binder) ReadMetaBytes(noteId string) ([]byte, error) {
	if b == nil {
		return nil, EmptyError
	}

	n := &json.Note{Id: noteId}
	fn := fs.MetaFile(n)

	f, err := b.fileSystem.Open(fn)
	if err != nil {
		// ファイルが存在しない場合は nil を返す（エラーではない）
		return nil, nil
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return nil, xerrors.Errorf("io.ReadAll() error: %w", err)
	}

	return data, nil
}

// UploadNoteImage はノートのメタ画像ファイルをアップロードする。
func (b *Binder) UploadNoteImage(noteId string, filePath string) error {
	if b == nil {
		return EmptyError
	}

	n := &json.Note{Id: noteId}
	mf, err := b.fileSystem.EditMetadata(n, filePath)
	if err != nil {
		return xerrors.Errorf("fs.EditMetadata() error: %w", err)
	}

	err = b.fileSystem.Commit(fs.M("Upload Note Image", noteId), mf)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

// DeleteNoteImage はノートのメタ画像ファイルを削除する。
// ファイルが存在しない場合は何もしない。
func (b *Binder) DeleteNoteImage(noteId string) error {
	if b == nil {
		return EmptyError
	}

	n := &json.Note{Id: noteId}
	mf, ok := b.fileSystem.DeleteMetaFile(n)
	if !ok {
		return nil
	}

	err := b.fileSystem.Commit(fs.M("Delete Note Image", noteId), mf)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}

func (b *Binder) SaveNote(noteId string, data []byte) error {
	if b == nil {
		return EmptyError
	}
	err := b.fileSystem.WriteNoteText(noteId, data)
	if err != nil {
		return xerrors.Errorf("fs.WriteNoteText() error: %w", err)
	}
	return nil
}

func (b *Binder) GetUnpublishedNotes() ([]*json.Note, error) {

	all, err := b.db.FindNotes()
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotes() error: %w", err)
	}

	// Structure情報を取得
	ids := make([]interface{}, len(all))
	for i, n := range all {
		ids[i] = n.Id
	}
	structMap, err := b.getStructureMap(ids...)
	if err != nil {
		return nil, xerrors.Errorf("getStructureMap() error: %w", err)
	}

	pr := make([]*json.Note, 0, len(all))
	for _, n := range all {

		m := n.To()
		if s, ok := structMap[n.Id]; ok {
			m.ApplyStructure(s.To())
		}

		err = b.fileSystem.SetNoteStatus(m)
		if err != nil {
			return nil, xerrors.Errorf("fs.SetNoteStatus() error: %w", err)
		}
		//最新じゃない場合は追加
		if m.PublishStatus != json.LatestStatus {
			pr = append(pr, m)
		}
	}
	return pr, nil
}

func (b *Binder) PublishNote(id string, data []byte) (*json.Note, error) {

	var files []string
	n, err := b.db.GetNote(id)
	if err != nil {
		return nil, xerrors.Errorf("db.GetNote() error: %w", err)
	}

	rtn := n.To()

	// publish/republish タイムスタンプを設定（updated_date と republish_date を同一時刻にするため PublishStructure を使用）
	s, err := b.db.PublishStructure(id, b.op)
	if err != nil {
		return nil, xerrors.Errorf("db.PublishStructure() error: %w", err)
	}
	rtn.ApplyStructure(s.To())

	files = append(files, fs.StructureTableFile())

	fn, err := b.fileSystem.PublishNote(data, rtn)
	if err != nil {
		return nil, xerrors.Errorf("fs.PublishNote() error: %w", err)
	}

	files = append(files, fn)

	// メタ画像が存在する場合は docs/images/meta/{alias} にコピー
	metaData, err := b.ReadMetaBytes(id)
	if err != nil {
		return nil, xerrors.Errorf("ReadMetaBytes() error: %w", err)
	}
	if metaData != nil {
		mf, err := b.fileSystem.PublishNoteMeta(metaData, rtn)
		if err != nil {
			return nil, xerrors.Errorf("fs.PublishNoteMeta() error: %w", err)
		}
		files = append(files, mf)
	}

	err = b.fileSystem.Commit(fs.M("Publish Note", rtn.Name), files...)
	if err != nil {
		return nil, xerrors.Errorf("Commit() error: %w", err)
	}

	return rtn, nil
}

// GetPublishedNotesByTemplate はテンプレートを使用している公開済みノートの一覧を返す。
// 一度も公開されていないノートは含まれない。
func (b *Binder) GetPublishedNotesByTemplate(templateId string) ([]*json.Leaf, error) {

	if b == nil {
		return nil, EmptyError
	}

	notes, err := b.db.FindNotesByTemplate(templateId)
	if err != nil {
		return nil, xerrors.Errorf("db.FindNotesByTemplate() error: %w", err)
	}
	if len(notes) == 0 {
		return nil, nil
	}

	ids := make([]interface{}, len(notes))
	for i, n := range notes {
		ids[i] = n.Id
	}
	structMap, err := b.getStructureMap(ids...)
	if err != nil {
		return nil, xerrors.Errorf("getStructureMap() error: %w", err)
	}

	var leaves []*json.Leaf
	for _, n := range notes {
		s, ok := structMap[n.Id]
		if !ok || s.Publish.IsZero() {
			continue
		}
		leaves = append(leaves, &json.Leaf{Id: n.Id, Name: s.Name, Type: "note"})
	}
	return leaves, nil
}

func (b *Binder) UnpublishNote(id string) error {

	n, err := b.db.GetNote(id)
	if err != nil {
		return xerrors.Errorf("db.GetNote() error: %w", err)
	}

	s, err := b.db.GetStructure(id)
	if err != nil {
		return xerrors.Errorf("db.GetStructure() error: %w", err)
	}

	rtn := n.To()
	rtn.ApplyStructure(s.To())

	// republish_date をリセットして非公開扱いにする
	err = b.db.UnpublishStructure(id, b.op)
	if err != nil {
		return xerrors.Errorf("db.UnpublishStructure() error: %w", err)
	}

	var files []string

	fn, err := b.fileSystem.UnpublishNote(rtn)
	if err != nil {
		return xerrors.Errorf("fs.UnpublishNote() error: %w", err)
	}
	files = append(files, fn, fs.StructureTableFile())

	// メタ画像が存在する場合も docs/images/meta/{alias} を削除
	if mf, ok := b.fileSystem.UnpublishNoteMeta(rtn); ok {
		files = append(files, mf)
	}

	err = b.fileSystem.Commit(fs.M("Unpublish Note", rtn.Name), files...)
	if err != nil && !errors.Is(err, fs.UpdatedFilesError) {
		return xerrors.Errorf("Commit() error: %w", err)
	}
	return nil
}
