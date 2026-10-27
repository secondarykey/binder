package db

import (
	"fmt"

	"binder/db/model"

	_ "github.com/mithrandie/csvq-driver"
	"golang.org/x/xerrors"
)

func (inst *Instance) ExistNote(id string) bool {
	n, err := inst.GetNote(id)
	if n != nil && err == nil {
		return true
	}
	return false
}


func (inst *Instance) FindNotes() ([]*model.Note, error) {
	return inst.findNote("", "updated_date desc", -1, -1)
}

func (inst *Instance) FindUpdatedNotes(id string, limit int, offset int) ([]*model.Note, error) {

	//TODO ツリーが更新されてないならダメ
	where := fmt.Sprintf("type = 'note' and private = false")
	if id != "" {
		where += fmt.Sprintf(" and parent_id = '%s'", id)
	}
	order := "updated_date desc"
	return inst.findStructureNotes(where, order, limit, offset)

	//return inst.findNote("", "updated_date desc", limit, offset)
}

func (inst *Instance) FindPublishNotes(id string, limit int, offset int) ([]*model.Note, error) {

	// publish_date は structures テーブルで管理されるため、先に公開済み note の ID を取得する
	order := "publish_date desc"
	return inst.findStructureNotes(publishedNoteWhere(id), order, limit, offset)
}

// FindSeqNotes は非公開でないノートをツリーの順で返す（プレビュー用）。
func (inst *Instance) FindSeqNotes(id string, limit int, offset int) ([]*model.Note, error) {
	where := "type = 'note' and private = false"
	if id != "" {
		where += fmt.Sprintf(" and parent_id = '%s'", id)
	}
	order := "seq"
	return inst.findStructureNotes(where, order, limit, offset)
}

// FindPublishSeqNotes は公開中のノートをツリーの順で返す（公開用）。
func (inst *Instance) FindPublishSeqNotes(id string, limit int, offset int) ([]*model.Note, error) {
	order := "seq"
	return inst.findStructureNotes(publishedNoteWhere(id), order, limit, offset)
}

// publishedNoteWhere は公開中のノートを絞り込む条件を返す。
// 公開を取り下げると republish_date だけが空に戻り publish_date は残るため、republish_date で判定する。
func publishedNoteWhere(id string) string {
	where := fmt.Sprintf("type = 'note' and private = false and !(republish_date = '%s')", TimeZero)
	if id != "" {
		where += fmt.Sprintf(" and parent_id = '%s'", id)
	}
	return where
}

func (inst *Instance) findStructureNotes(where string, order string, limit int, offset int) ([]*model.Note, error) {
	structs, err := inst.findStructure(where, order, limit, offset)
	if err != nil {
		return nil, xerrors.Errorf("findStructure() error: %w", err)
	}
	if len(structs) == 0 {
		return nil, nil
	}
	ids := make([]interface{}, len(structs))
	for i, s := range structs {
		ids[i] = s.Id
	}
	notes, err := inst.FindInNoteId(ids...)
	if err != nil {
		return nil, xerrors.Errorf("FindInNoteId() error: %w", err)
	}

	// FindInNoteId は updated_date で並べ直すため、structures で指定した順に戻す
	noteMap := make(map[string]*model.Note, len(notes))
	for _, n := range notes {
		noteMap[n.Id] = n
	}
	rtn := make([]*model.Note, 0, len(notes))
	for _, s := range structs {
		if n, ok := noteMap[s.Id]; ok {
			rtn = append(rtn, n)
		}
	}
	return rtn, nil
}

func (inst *Instance) FindInNoteId(ids ...interface{}) ([]*model.Note, error) {
	return inst.findNote("id in ("+csvQ(ids)+")", "updated_date desc", -1, -1, ids...)
}

// FindNotesByTemplate はlayout_templateまたはcontent_templateに指定IDを持つノートを返す。
// テンプレート削除前の参照チェックに使用する。
func (inst *Instance) FindNotesByTemplate(templateId string) ([]*model.Note, error) {
	return inst.findNote("layout_template = ? OR content_template = ?", "", -1, -1, templateId, templateId)
}
