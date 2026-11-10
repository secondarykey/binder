package api

import (
	"binder"
	"binder/api/json"
	"binder/fs"
	"binder/log"
	"binder/settings"
	"binder/setup"
	"fmt"

	"golang.org/x/xerrors"
)

func (a *App) LoadBinder(dir string) (result string, err error) {

	defer log.PrintTrace(log.Func("LoadBinder()"))

	// ロードは同時に1本だけにする（loadMu のコメント参照）
	a.loadMu.Lock()
	defer a.loadMu.Unlock()

	// 予期しないパニックをエラーに変換してアプリのクラッシュを防ぐ
	defer func() {
		if r := recover(); r != nil {
			log.PrintStackTrace(fmt.Errorf("panic in LoadBinder: %v", r))
			err = fmt.Errorf("unexpected error opening binder: %v", r)
		}
	}()

	if dir == "" {
		return "", xerrors.Errorf("%s", settings.T("go.error.emptyDirectory"))
	}

	b, err := binder.Load(dir)
	if err != nil {
		return "", userError(err)
	}

	// HTTPサーバは起動時には立てず、「ブラウザで開く」などで必要になった時点で
	// EnsureServing() により遅延起動する。

	// バインダー切り替え時にバインダー関連ウィンドウを閉じる
	if a.WindowCloser != nil {
		a.WindowCloser.CloseBinderWindows()
	}

	// フロントはバインダーの切り替えで CloseBinder を経ずに LoadBinder を呼ぶため、
	// 前のバインダーをここで閉じる。閉じないと「開いている」印（fs/openmark.go）が
	// 残り、外部のツールから切り替え前のバインダーがまだ開いているように見える。
	// 同じバインダーの開き直しでも印は参照カウントなので、新しい方の分が残る
	prev := a.current
	a.SetCurrent(b)
	if prev != nil {
		if err := prev.Close(); err != nil {
			log.Warnf("前のバインダーを閉じられません:\n%+v", err)
		}
	}

	// バインダーを問題なく開けた = この起動は安全と確定できるので、
	// クラッシュ検出フラグ StartupOk を true に戻す（次回起動で自動オープンを許可）。
	// 起動時は StartupOk(false) を書いており、従来は正常終了時のみ true に戻していたが、
	// 開発モードのホットリロード等で正常終了しないと false のまま残るため、
	// 最初のバインダーを開けた時点で true にする。
	// 保存は直後の SaveHistory に相乗りさせ、書き込み回数を増やさない（メモリ上で立てるだけ）。
	if !a.startupOkSaved {
		settings.MarkStartupOk()
		a.startupOkSaved = true
	}

	address, err := a.Address()
	if err != nil {
		return "", userError(err)
	}

	// 履歴を保存（最近開いたバインダーを先頭にする）。
	// 上で立てた StartupOk もこの save() で一緒に永続化される。
	if err := settings.SaveHistory(dir); err != nil {
		log.Warnf("SaveHistory error:\n%+v", err)
	}

	return address, nil
}

func (a *App) CloseBinder() error {

	defer log.PrintTrace(log.Func("CloseBinder()"))

	// バインダー選択画面に戻る際にバインダー関連ウィンドウを閉じる
	if a.WindowCloser != nil {
		a.WindowCloser.CloseBinderWindows()
	}

	if a.current != nil {
		err := a.current.Close()
		a.current = nil

		if err != nil {
			log.PrintStackTrace(err)
			return userError(err)
		}
	}
	return nil
}

// TakeDoctorReport は、開いたときに整合性を修復した内容を返す（一度だけ。次からは nil）。
// 修復が無ければ nil。外部のツールでバインダーを編集した後の書き損じなどを、
// フロントがバインダーを開いた直後に知らせるために使う。
func (a *App) TakeDoctorReport() (*json.DoctorReport, error) {

	defer log.PrintTrace(log.Func("TakeDoctorReport()"))

	if a.current == nil {
		return nil, nil
	}
	rep := a.current.TakeDoctorReport()
	if !rep.Repaired() {
		return nil, nil
	}

	var items []*json.DoctorItem
	add := func(kind string, list []fs.RestoredEntity) {
		for _, e := range list {
			items = append(items, &json.DoctorItem{Id: e.Id, Typ: e.Typ, Name: e.Name, Kind: kind})
		}
	}
	// 本文が失われたもの（recreated）を先に並べる
	add("recreated", rep.FilesRecreated)
	add("orphan", rep.OrphanRestored)
	add("row", rep.RowsRestored)
	add("reparented", rep.Reparented)
	return &json.DoctorReport{Items: items}, nil
}

// holdOpen は、バインダーを閉じて fs.Load で直接書き込み、開き直す操作（復元・ブランチ切替・
// 取り込み・履歴の整理）の間も「開いている」印を持ち続けるためのもの（fs/openmark.go）。
// 閉じてから開き直すまでの間に印が消えると、外部のツールが「閉じている」と見てしまう。
// 使い方: defer a.holdOpen(dir)()
func (a *App) holdOpen(dir string) func() {
	if err := fs.AcquireOpen(dir); err != nil {
		log.Warnf("holdOpen(%s):\n%+v", dir, err)
		return func() {}
	}
	return func() { fs.ReleaseOpen(dir) }
}

func (a *App) CreateBinder(dir string, name string, installType string) (string, error) {

	defer log.PrintTrace(log.Func("CreateBinder()"))

	err := setup.Install(dir, a.version, name, installType)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	return address, nil
}

func (a *App) GetInstallPresets() []setup.InstallPreset {
	return setup.GetInstallPresets()
}

func (a *App) CreateRemoteBinder(url, dir, branch, workBranch string, info *json.UserInfo, save bool) (string, error) {

	defer log.PrintTrace(log.Func("CreateRemoteBinder()"))

	err := binder.CreateRemote(url, dir, branch, workBranch, info, save, a.version)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	address, err := a.LoadBinder(dir)
	if err != nil {
		log.PrintStackTrace(err)
		return "", userError(err)
	}

	return address, nil
}

// Generate は指定エンティティを公開する。
// テンプレート関数の警告（未公開のアセットを参照している等）を返す。
// 公開自体は止めないが、公開後に 404 になる参照に気付けるようフロントで表示する。
func (a *App) Generate(mode string, id string, data string) ([]string, error) {

	defer log.PrintTrace(log.Func("Generate()", mode, id))

	var warnings []string
	var err error
	switch mode {
	case "note":

		result, genErr := a.CreateNoteHTML(id, false, data)
		if genErr != nil {
			err = genErr
		} else if result.Error != "" {
			err = fmt.Errorf("%s", result.Error)
		}
		if err == nil {
			warnings = result.Warnings
			for _, w := range warnings {
				log.Warnf("Generate warning: %s", w)
			}
			_, err = a.current.PublishNote(id, []byte(result.HTML))
		}

	case "diagram":
		_, err = a.current.PublishDiagram(id, []byte(data))
	case "assets":
		_, err = a.current.PublishAsset(id)
	case "layer":
		_, err = a.current.PublishLayer(id)

	default:
		//templateはないはず
		log.Warnf("Unknown Mode:%s", mode)
	}

	if err != nil {
		return nil, userError(err)
	}
	return warnings, nil
}

// GenerateAll は複数の公開アイテムをまとめて処理し、全ファイルを1つのコミットにまとめる。
// Generate と同様にテンプレート関数の警告を返す。
func (a *App) GenerateAll(items []*json.GenerateItem, message string) ([]string, error) {

	defer log.PrintTrace(log.Func("GenerateAll()", len(items)))

	// 同時に公開するもの同士の参照（childNotes・link 等）が未公開扱いにならないよう、
	// HTML を作る前にまとめて公開済みにしておく
	var ids []string
	for _, item := range items {
		switch item.Mode {
		case "note", "diagram", "assets", "layer":
			ids = append(ids, item.Id)
		}
	}
	batch, err := a.current.BeginPublish(ids...)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	// 途中で失敗したら、まだ書き出していないものを公開前に戻す
	fail := func(err error) ([]string, error) {
		if rerr := batch.Rollback(); rerr != nil {
			log.PrintStackTrace(rerr)
		}
		return nil, err
	}

	var allFiles []string
	var warnings []string
	for _, item := range items {
		switch item.Mode {
		case "note":
			result, err := a.CreateNoteHTML(item.Id, false, item.Data)
			if err != nil {
				return fail(userError(err))
			}
			if result.Error != "" {
				return fail(xerrors.Errorf("CreateNoteHTML() parse error: %s", result.Error))
			}
			for _, w := range result.Warnings {
				log.Warnf("GenerateAll warning: %s", w)
			}
			warnings = append(warnings, result.Warnings...)
			files, _, err := a.current.PublishNoteStage(item.Id, []byte(result.HTML))
			if err != nil {
				return fail(userError(err))
			}
			batch.Done(item.Id)
			allFiles = append(allFiles, files...)
		case "diagram":
			files, _, err := a.current.PublishDiagramStage(item.Id, []byte(item.Data))
			if err != nil {
				return fail(userError(err))
			}
			batch.Done(item.Id)
			allFiles = append(allFiles, files...)
		case "assets":
			files, _, err := a.current.PublishAssetStage(item.Id)
			if err != nil {
				return fail(userError(err))
			}
			batch.Done(item.Id)
			allFiles = append(allFiles, files...)
		case "layer":
			files, _, err := a.current.PublishLayerStage(item.Id)
			if err != nil {
				return fail(userError(err))
			}
			batch.Done(item.Id)
			allFiles = append(allFiles, files...)
		default:
			log.Warnf("Unknown Mode:%s", item.Mode)
		}
	}

	if err := a.current.CommitFiles(message, allFiles...); err != nil {
		return nil, userError(err)
	}
	return warnings, nil
}

// GetUnpublishedRefs はノートが参照している、まだ公開していない図・アセット・レイヤーを返す。
// text はエディタ上の Markdown。ノートと一緒に公開するかをフロントで選ばせるために使う。
func (a *App) GetUnpublishedRefs(noteId string, text string) ([]*json.PublishRef, error) {

	defer log.PrintTrace(log.Func("GetUnpublishedRefs()", noteId))

	refs, err := a.current.GetUnpublishedRefs(noteId, text)
	if err != nil {
		log.PrintStackTrace(err)
		return nil, userError(err)
	}
	return refs, nil
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
		log.Warnf("Unknown Mode:%s", mode)
	}

	if err != nil {
		return userError(err)
	}
	return nil
}

func (a *App) UnpublishAll() error {

	defer log.PrintTrace(log.Func("UnpublishAll()"))

	if err := a.current.UnpublishAll(); err != nil {
		return userError(err)
	}
	return nil
}

func (a *App) GetFullPath(mode, id string) string {
	defer log.PrintTrace(log.Func("GetFullPath()", mode, id))
	return a.current.GetFullPath(mode, id)
}
