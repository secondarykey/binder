package api

import (
	"binder"
	"binder/api/json"
	"binder/log"
	"binder/settings"
	"binder/setup"
	"fmt"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) (result string, err error) {

	defer log.PrintTrace(log.Func("LoadBinder()"))

	// 予期しないパニックをエラーに変換してアプリのクラッシュを防ぐ
	defer func() {
		if r := recover(); r != nil {
			log.PrintStackTrace(fmt.Errorf("panic in LoadBinder: %v", r))
			err = fmt.Errorf("unexpected error opening binder: %v", r)
		}
	}()

	if dir == "" {
		return "", xerrors.Errorf("empty directory error")
	}

	b, err := binder.Load(dir)
	if err != nil {
		return "", xerrors.Errorf("Binder Load() error: %w", err)
	}

	err = b.Serve()
	if err != nil {
		return "", xerrors.Errorf("Binder Serve() error: %w", err)
	}
	a.SetCurrent(b)

	address, err := a.Address()
	if err != nil {
		return "", xerrors.Errorf("Binder Address() error: %w", err)
	}

	// 履歴を保存（最近開いたバインダーを先頭にする）
	if err := settings.SaveHistory(dir); err != nil {
		log.WarnE("SaveHistory error", err)
	}

	return address, nil
}

func (a *App) CloseBinder() error {

	defer log.PrintTrace(log.Func("CloseBinder()"))

	if a.current != nil {
		err := a.current.Close()
		a.current = nil

		if err != nil {
			log.PrintStackTrace(err)
			return fmt.Errorf("binder Close() error\n%+v", err)
		}
	}
	return nil
}

func (a *App) CreateBinder(dir string, name string) (string, error) {

	defer log.PrintTrace(log.Func("CreateBinder()"))

	err := setup.Install(dir, a.version, name)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("setup.Install error\n%+v", err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("binder load error\n%+v", err)
	}

	return address, nil
}

func (a *App) CreateRemoteBinder(url, dir, branch, workBranch string, info *json.UserInfo, save bool) (string, error) {

	defer log.PrintTrace(log.Func("CreateRemoteBinder()"))

	err := binder.CreateRemote(url, dir, branch, workBranch, info, save, a.version)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("CreateRemote() error\n%+v", err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", fmt.Errorf("load() error\n%+v", err)
	}

	return address, nil
}

func (a *App) Generate(mode string, id string, data string) error {

	defer log.PrintTrace(log.Func("Generate()", mode, id))

	var err error
	switch mode {
	case "note":

		html, err := a.CreateNoteHTML(id, data)
		if err == nil {
			_, err = a.current.PublishNote(id, []byte(html))
		}

	case "diagram":
		_, err = a.current.PublishDiagram(id, []byte(data))
	case "assets":
		_, err = a.current.PublishAsset(id)
	case "layer":
		_, err = a.current.PublishLayer(id)

	default:
		//templateはないはず
		log.Warn("Unknown Mode:" + mode)
	}

	if err != nil {
		return xerrors.Errorf("Publish() error: %+v", err)
	}
	return nil
}

// GenerateAll は複数の公開アイテムをまとめて処理し、全ファイルを1つのコミットにまとめる。
func (a *App) GenerateAll(items []*json.GenerateItem, message string) error {

	defer log.PrintTrace(log.Func("GenerateAll()", len(items)))

	var allFiles []string
	for _, item := range items {
		switch item.Mode {
		case "note":
			html, err := a.CreateNoteHTML(item.Id, item.Data)
			if err != nil {
				return xerrors.Errorf("CreateNoteHTML() error: %+v", err)
			}
			files, _, err := a.current.PublishNoteStage(item.Id, []byte(html))
			if err != nil {
				return xerrors.Errorf("PublishNoteStage() error: %+v", err)
			}
			allFiles = append(allFiles, files...)
		case "diagram":
			files, _, err := a.current.PublishDiagramStage(item.Id, []byte(item.Data))
			if err != nil {
				return xerrors.Errorf("PublishDiagramStage() error: %+v", err)
			}
			allFiles = append(allFiles, files...)
		case "assets":
			files, _, err := a.current.PublishAssetStage(item.Id)
			if err != nil {
				return xerrors.Errorf("PublishAssetStage() error: %+v", err)
			}
			allFiles = append(allFiles, files...)
		case "layer":
			files, _, err := a.current.PublishLayerStage(item.Id)
			if err != nil {
				return xerrors.Errorf("PublishLayerStage() error: %+v", err)
			}
			allFiles = append(allFiles, files...)
		default:
			log.Warn("Unknown Mode:" + item.Mode)
		}
	}

	if err := a.current.CommitFiles(message, allFiles...); err != nil {
		return xerrors.Errorf("CommitFiles() error: %+v", err)
	}
	return nil
}

func (a *App) Unpublish(mode string, id string) error {

	defer log.PrintTrace(log.Func("Unpublish()", mode, id))

	var err error
	switch mode {
	case "note":
		err = a.current.UnpublishNote(id)
	case "diagram":
		err = a.current.UnpublishDiagram(id)
	case "assets":
		err = a.current.UnpublishAsset(id)
	case "layer":
		err = a.current.UnpublishLayer(id)
	default:
		log.Warn("Unknown Mode:" + mode)
	}

	if err != nil {
		return xerrors.Errorf("Unpublish() error: %+v", err)
	}
	return nil
}

func (a *App) GetFullPath(mode, id string) string {
	defer log.PrintTrace(log.Func("GetFullPath()", mode, id))
	return a.current.GetFullPath(mode, id)
}
