package binder

import (
	"binder/api/json"
	"binder/fs"
	"binder/log"
	"fmt"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

// CreateMergeLogNote はマージ操作の詳細をノートとして記録する。
// Binder が開いている状態で呼び出すこと。
func (b *Binder) CreateMergeLogNote(mergeLog *fs.MergeLog) error {

	if b == nil {
		return EmptyError
	}

	if mergeLog == nil {
		return nil
	}

	// ノート名を生成
	name := fmt.Sprintf("Merge Log: %s/%s → %s",
		mergeLog.RemoteName, mergeLog.RemoteBranch, mergeLog.LocalBranch)

	// Markdown コンテンツを生成
	content := buildMergeLogMarkdown(mergeLog)

	// ノートID を生成
	noteId := b.generateId()
	if noteId == "" {
		return xerrors.Errorf("failed to generate note ID")
	}

	n := &json.Note{
		Id:       noteId,
		ParentId: "index",
		Name:     name,
		Detail:   fmt.Sprintf("Merge at %s", time.Now().Format("2006-01-02 15:04:05")),
		Alias:    noteId,
	}

	// ContentTemplate をデフォルト設定
	dt, err := b.db.FindDefaultContentTemplate()
	if err != nil {
		log.WarnE("FindDefaultContentTemplate() error", err)
	} else if dt != nil {
		n.ContentTemplate = dt.Id
	}

	// ノートファイルを作成
	fn, err := b.createNote(n)
	if err != nil {
		return xerrors.Errorf("createNote() error: %w", err)
	}

	// Structure を作成
	err = b.createStructure(n.Id, n.ParentId, "note", n.Name, n.Detail, n.Alias)
	if err != nil {
		return xerrors.Errorf("createStructure() error: %w", err)
	}

	// Markdown コンテンツを書き込み
	err = b.fileSystem.WriteNoteText(noteId, []byte(content))
	if err != nil {
		return xerrors.Errorf("WriteNoteText() error: %w", err)
	}

	// コミット
	files := []string{fn, fs.NoteTableFile(), fs.StructureTableFile()}
	err = b.fileSystem.Commit(fs.M("Merge Log", name), files...)
	if err != nil {
		return xerrors.Errorf("Commit() error: %w", err)
	}

	return nil
}

// buildMergeLogMarkdown はマージログの Markdown テキストを生成する。
func buildMergeLogMarkdown(ml *fs.MergeLog) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Merge Log: %s/%s → %s\n\n",
		ml.RemoteName, ml.RemoteBranch, ml.LocalBranch))
	sb.WriteString(fmt.Sprintf("- **日時**: %s\n", time.Now().Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("- **リモート**: %s\n", ml.RemoteName))
	sb.WriteString(fmt.Sprintf("- **ブランチ**: %s → %s\n\n", ml.RemoteBranch, ml.LocalBranch))

	// 自動解決ファイル
	autoNonCSV := make([]fs.ResolvedFile, 0)
	autoCSV := make([]fs.ResolvedFile, 0)
	for _, f := range ml.AutoFiles {
		if f.Resolution == "merged" {
			autoCSV = append(autoCSV, f)
		} else {
			autoNonCSV = append(autoNonCSV, f)
		}
	}

	if len(autoNonCSV) > 0 || len(autoCSV) > 0 {
		total := len(autoNonCSV) + len(autoCSV)
		sb.WriteString(fmt.Sprintf("## 自動解決されたファイル (%d件)\n\n", total))
		sb.WriteString("| ファイル | 解決 |\n")
		sb.WriteString("|---------|------|\n")
		for _, f := range autoNonCSV {
			label := resolutionLabel(f.Resolution)
			sb.WriteString(fmt.Sprintf("| %s | %s |\n", f.Path, label))
		}
		for _, f := range autoCSV {
			sb.WriteString(fmt.Sprintf("| %s | 行単位マージ |\n", f.Path))
		}
		sb.WriteString("\n")
	}

	// CSV マージ詳細
	if len(ml.MergedCSVs) > 0 {
		sb.WriteString("## CSV行単位マージの詳細\n\n")
		for path, info := range ml.MergedCSVs {
			if !info.Changed {
				continue
			}
			sb.WriteString(fmt.Sprintf("### %s\n\n", path))
			writeCSVDetails(&sb, info)
			sb.WriteString("\n")
		}
	}

	// ユーザー選択
	if len(ml.UserFiles) > 0 {
		sb.WriteString(fmt.Sprintf("## ユーザー選択で解決したファイル (%d件)\n\n", len(ml.UserFiles)))
		sb.WriteString("| ファイル | 選択 |\n")
		sb.WriteString("|---------|------|\n")
		for _, f := range ml.UserFiles {
			label := resolutionLabel(f.Resolution)
			sb.WriteString(fmt.Sprintf("| %s | %s |\n", f.Path, label))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// writeCSVDetails は mergedCSV の詳細をMarkdown形式で書き出す。
func writeCSVDetails(sb *strings.Builder, info *fs.MergedCSV) {
	for _, r := range info.AddedOurs {
		sb.WriteString(fmt.Sprintf("- 追加(ローカル): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
	for _, r := range info.AddedTheirs {
		sb.WriteString(fmt.Sprintf("- 追加(リモート → indexに配置): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
	for _, r := range info.DeletedOurs {
		sb.WriteString(fmt.Sprintf("- 削除(ローカル): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
	for _, r := range info.DeletedTheirs {
		sb.WriteString(fmt.Sprintf("- 削除(リモート): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
	for _, r := range info.UpdatedOurs {
		sb.WriteString(fmt.Sprintf("- 更新(ローカル優先): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
	for _, r := range info.UpdatedTheirs {
		sb.WriteString(fmt.Sprintf("- 更新(リモート採用): id=%s", r.Id))
		if r.Name != "" {
			sb.WriteString(fmt.Sprintf(", name=\"%s\"", r.Name))
		}
		sb.WriteString("\n")
	}
}

func resolutionLabel(resolution string) string {
	switch resolution {
	case "ours":
		return "ローカル採用"
	case "theirs":
		return "リモート採用"
	case "both":
		return "両方結合"
	case "merged":
		return "行単位マージ"
	default:
		return resolution
	}
}
