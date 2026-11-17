package api

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"binder/api/json"
	"binder/db"
	bfs "binder/fs"
	"binder/test"
)

// 読み取り専用で開く（_docs/readonly-open.md）のテスト。
//
// 要は TestReadOnlyWritesNothing: 読み取り専用で開いたバインダーに、App の書き込み系メソッドを
// 全部呼んでも、.git を含むディレクトリが 1 バイトも変わらないこと。
// App の公開メソッドは下の分類のどれかに入っていなければならない（TestReadOnlyMethodsClassified）。
// 新しい API を足したら、どこかに入れるまでテストが落ちる。書き込むものは readOnlyWriteMethods に入れる。

// readOnlyReadMethods は読むだけのメソッド（バインダーに書かない）。
var readOnlyReadMethods = []string{
	"GetVersionInfo", "SearchBinder", "Address", "EnsureAddress",
	"GetAsset", "GetAssetContent", "DetectAssetMime",
	"TakeDoctorReport", "GetInstallPresets", "GetUnpublishedRefs", "GetFullPath", "IsReadOnly",
	"GetConfig", "GetPublishSettings", "GetUserInfo", "IsBinderTrusted",
	"GetDiagram", "OpenDiagram",
	"CollectExportDeps", "GetBinderName",
	"Remotes", "CurrentBranch", "RemoteList", "GetModifiedIds", "GetNowPatch",
	"GetOverallHistory", "GetCommitFiles", "GetOverallHistoryByPath", "GetCommitFilesByPath",
	"ListBranchesByPath", "CurrentBranchByPath", "GetHistory", "GetHistoryPatch", "ListBranches", "GetCleanupInfo",
	"CreateNoteHTML", "ParseNote", "ParseAsset", "ParseDiagram", "CreateTemplateHTML",
	"GetLayer", "GetLayerWithParent", "GetLayerContent", "GetLayerSVG",
	"GetNote", "GetNoteImageURL", "OpenNote",
	"GetPlugins", "ListPlugins", "GetPluginVerifiedMajors",
	"ListRootFiles", "ReadRootFile", "ListRootFileTemplates", "ReadRootFileTemplate",
	"CheckCompat",
	"GetStructure", "HasChildren", "ResolveBinderLink",
	"GetTemplate", "OpenTemplate", "GetPublishedNotesByTemplate", "GetHTMLTemplates",
	"GetBinderTree", "GetTemplateTree", "GetModifiedTree", "GetUnpublishedTree", "GetPublishedTree",
}

// readOnlyWriteMethods はバインダーに書き込むメソッド。読み取り専用では全部失敗し、何も書かないこと。
var readOnlyWriteMethods = []string{
	"InstallAppPlugin",
	"EditAsset", "DropAsset", "ImportLocalFiles", "SaveAssetContent", "AddTextAsset", "RemoveAsset",
	"SetAssetAsMetaImage", "MigrateAssetToNote",
	"Generate", "GenerateAll", "Unpublish", "UnpublishAll",
	"EditConfig", "EditUserInfo",
	"EditDiagram", "RemoveDiagram", "SaveDiagram",
	"CommitFiles", "AutoSave", "Commit", "AddRemote", "EditRemote", "DeleteRemote", "Push", "PushDocs",
	"ListRemoteBranches", "MergeFromRemote", "MergeFromLocal", "ApplyMergeResolution",
	"RestoreHistory", "RestoreToCommit", "RestoreToCommitByPath", "SwitchBranchByPath",
	"SwitchBranch", "CreateBranch", "SquashHistory", "RunGC", "RenameBranch",
	"EditLayer", "RemoveLayer", "SaveLayerContent",
	"EditNote", "RemoveNote", "UploadNoteImage", "DeleteNoteImage", "PrivatizeChildren", "SaveNote",
	"SavePlugin", "RemovePlugin", "RenamePlugin",
	"SaveRootFile", "RemoveRootFile", "RenameRootFile",
	"Convert",
	"EditTemplate", "RemoveTemplate", "SaveTemplate", "UpdateTemplateSeqs",
	"MoveNode",
}

// readOnlyAppMethods はバインダーの外（アプリの設定 ~/.binder、利用者が選んだ保存先）にだけ書くもの。
// 読み取り専用でも使ってよい。このテストでは呼ばない（設定の保存先は TestMain で一時ディレクトリだが、
// ダウンロードはカレントディレクトリに書いてしまうため）。
var readOnlyAppMethods = []string{
	"ListAppPlugins", "SaveAppPlugin", "RemoveAppPlugin", "RenameAppPlugin",
	"SetBinderTrusted", "SetPluginVerifiedMajor",
	"DownloadDocs", "DownloadAll", "DownloadNote",
	"Setup",
	"SavePosition", "SaveFont", "GetFont", "GetHistories", "SaveHistory", "GetPath", "SavePath",
	"GetTheme", "SetTheme", "GetLanguage", "SetLanguage", "GetEditor", "SaveEditor", "GetGit", "SaveGit",
	"GetTreeDisplayMode", "SetTreeDisplayMode", "GetAutoSave", "SaveAutoSave",
	"GetTreeExpandTargets", "SetTreeExpandTargets", "GetPreviewScrollbar", "SetPreviewScrollbar",
	"SaveLastData", "IsGitBashPath", "GetGitBashFullPath", "GetAllowedCDNs", "SaveAllowedCDNs",
	"GetSnippets", "SaveSnippets",
}

// readOnlyLifecycleMethods はバインダーを開く・閉じる・作るもの。このテストでは呼ばない。
var readOnlyLifecycleMethods = []string{
	"LoadBinder", "LoadBinderReadOnly", "CloseBinder", "CreateBinder", "CreateRemoteBinder",
	"SetCurrent", "SetDevMode",
}

// readOnlyMayNoop は、することが無ければ何もせずに成功を返す書き込み系メソッド
// （テスト用のバインダーには未記録・公開済み・メタ画像が無い）。何も書いていないことはハッシュで確かめる。
var readOnlyMayNoop = map[string]bool{
	"AutoSave": true, "Unpublish": true, "UnpublishAll": true, "DeleteNoteImage": true,
}

// readOnlyArgs は、引数を自動で作ると書き込みの手前で止まってしまうメソッドの引数。
var readOnlyArgs = map[string]func(id string) []any{
	"Generate": func(id string) []any { return []any{"note", id, ""} },
}

// TestReadOnlyMethodsClassified は App の公開メソッドがすべて分類されていることを確かめる。
func TestReadOnlyMethodsClassified(t *testing.T) {
	known := map[string]string{}
	for list, names := range map[string][]string{
		"read": readOnlyReadMethods, "write": readOnlyWriteMethods,
		"app": readOnlyAppMethods, "lifecycle": readOnlyLifecycleMethods,
	} {
		for _, n := range names {
			if prev, ok := known[n]; ok {
				t.Errorf("%s が %s と %s の両方に入っている", n, prev, list)
			}
			known[n] = list
		}
	}

	typ := reflect.TypeOf(&App{})
	var missing []string
	have := map[string]bool{}
	for i := 0; i < typ.NumMethod(); i++ {
		name := typ.Method(i).Name
		have[name] = true
		if _, ok := known[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		t.Errorf("読み取り専用の分類に入っていないメソッド（readonly_test.go のどれかに入れる。書き込むなら readOnlyWriteMethods）: %v", missing)
	}
	for n := range known {
		if !have[n] {
			t.Errorf("%s は App に無い（分類から消す）", n)
		}
	}
}

// snapshotDir はディレクトリの中身（パス → 内容のハッシュ。ディレクトリは "dir"）を返す。
// csvq が読むときに作って消す一時ファイル（.rlock など）は除く。
func snapshotDir(t *testing.T, dir string) map[string]string {
	t.Helper()
	snap := map[string]string{}
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(dir, p)
		name := d.Name()
		if strings.HasSuffix(name, ".rlock") || strings.HasSuffix(name, ".temp") ||
			(strings.HasSuffix(name, ".lock") && !strings.HasPrefix(rel, ".git")) {
			return nil
		}
		if d.IsDir() {
			snap[rel] = "dir"
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(data)
		snap[rel] = hex.EncodeToString(sum[:])
		return nil
	})
	if err != nil {
		t.Fatalf("WalkDir() error: %v", err)
	}
	return snap
}

func diffSnapshot(before, after map[string]string) []string {
	var diff []string
	for k, v := range before {
		if a, ok := after[k]; !ok {
			diff = append(diff, "削除: "+k)
		} else if a != v {
			diff = append(diff, "変更: "+k)
		}
	}
	for k := range after {
		if _, ok := before[k]; !ok {
			diff = append(diff, "追加: "+k)
		}
	}
	sort.Strings(diff)
	return diff
}

// argsFor はメソッドの引数を作る。文字列は既存のノートの ID にして、なるべく書き込みの手前まで進ませる。
// 構造体は Id / ParentId / Name があれば埋める。
func argsFor(m reflect.Method, id string) []reflect.Value {
	ft := m.Type
	var args []reflect.Value
	for i := 1; i < ft.NumIn(); i++ { // 0 はレシーバ
		args = append(args, valueFor(ft.In(i), id))
	}
	return args
}

func valueFor(t reflect.Type, id string) reflect.Value {
	switch t.Kind() {
	case reflect.String:
		return reflect.ValueOf(id).Convert(t)
	case reflect.Int, reflect.Int64, reflect.Int32:
		return reflect.ValueOf(1).Convert(t)
	case reflect.Bool:
		return reflect.ValueOf(true)
	case reflect.Slice:
		s := reflect.MakeSlice(t, 1, 1)
		s.Index(0).Set(valueFor(t.Elem(), id))
		return s
	case reflect.Ptr:
		p := reflect.New(t.Elem())
		fillStruct(p.Elem(), id)
		return p
	case reflect.Struct:
		v := reflect.New(t).Elem()
		fillStruct(v, id)
		return v
	default:
		return reflect.Zero(t)
	}
}

func fillStruct(v reflect.Value, id string) {
	if v.Kind() != reflect.Struct {
		return
	}
	for _, name := range []string{"Id", "ParentId", "Name", "Path", "SourceBranch", "Mode", "Type"} {
		f := v.FieldByName(name)
		if f.IsValid() && f.CanSet() && f.Kind() == reflect.String {
			f.SetString(id)
		}
	}
}

// TestReadOnlyWritesNothing は、読み取り専用で開いたバインダーに書き込み系のメソッドを全部呼んでも
// ディレクトリが変わらず、どれも失敗することを確かめる。
func TestReadOnlyWritesNothing(t *testing.T) {
	const name = "readonly_writes_nothing"
	b := test.CreateBinder(t, name)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	dir := filepath.Join(test.Dir, name)

	app := New(test.LatestVersion.String())
	if _, err := app.LoadBinderReadOnly(dir); err != nil {
		t.Fatalf("LoadBinderReadOnly() error: %v", err)
	}
	t.Cleanup(func() { app.CloseBinder() })

	if !app.IsReadOnly() {
		t.Fatal("IsReadOnly() = false")
	}
	if openMarked(t, dir) {
		t.Error("読み取り専用なのに「開いている」印を立てている")
	}

	// 読むものは読める
	tree, err := app.GetBinderTree()
	if err != nil || len(tree.Data) == 0 {
		t.Fatalf("GetBinderTree() = %+v, %v", tree, err)
	}
	f := &closedFixture{t: t, app: app, dir: dir}
	ids := f.noteIds()
	if len(ids) == 0 {
		t.Fatal("ノートが無い")
	}
	noteId := ids[0]
	if _, err := app.OpenNote(noteId); err != nil {
		t.Fatalf("OpenNote() error: %v", err)
	}
	if _, err := app.GetOverallHistory(10, 0); err != nil {
		t.Fatalf("GetOverallHistory() error: %v", err)
	}

	before := snapshotDir(t, dir)
	typ := reflect.TypeOf(app)
	for _, name := range readOnlyWriteMethods {
		m, ok := typ.MethodByName(name)
		if !ok {
			t.Errorf("%s が無い", name)
			continue
		}
		var errOut error
		func() {
			defer func() {
				if r := recover(); r != nil {
					errOut = errors.New("panic")
					t.Errorf("%s: panic: %v", name, r)
				}
			}()
			args := argsFor(m, noteId)
			if fn, ok := readOnlyArgs[name]; ok {
				args = nil
				for _, a := range fn(noteId) {
					args = append(args, reflect.ValueOf(a))
				}
			}
			out := m.Func.Call(append([]reflect.Value{reflect.ValueOf(app)}, args...))
			if len(out) > 0 {
				if e, ok := out[len(out)-1].Interface().(error); ok {
					errOut = e
				}
			}
		}()
		if errOut == nil && !readOnlyMayNoop[name] {
			t.Errorf("%s: 読み取り専用なのにエラーにならない", name)
		}
		if diff := diffSnapshot(before, snapshotDir(t, dir)); len(diff) > 0 {
			t.Fatalf("%s: 読み取り専用なのにバインダーが変わった: %v", name, diff)
		}
		if app.current == nil || !app.current.ReadOnly() {
			t.Fatalf("%s: 読み取り専用のバインダーが閉じられた・開き直された", name)
		}
	}

	// まだ読める
	if _, err := app.OpenNote(noteId); err != nil {
		t.Fatalf("書き込みを試したあとの OpenNote() error: %v", err)
	}
}

// 書き込みのエラーは「読み取り専用で開いています」（warning）になる。
func TestReadOnlyErrorMessage(t *testing.T) {
	const name = "readonly_message"
	b := test.CreateBinder(t, name)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	dir := filepath.Join(test.Dir, name)

	app := New(test.LatestVersion.String())
	if _, err := app.LoadBinderReadOnly(dir); err != nil {
		t.Fatalf("LoadBinderReadOnly() error: %v", err)
	}
	t.Cleanup(func() { app.CloseBinder() })

	f := &closedFixture{t: t, app: app, dir: dir}
	noteId := f.noteIds()[0]

	for name, call := range map[string]func() error{
		"SaveNote (fs)":      func() error { return app.SaveNote(noteId, "x") },
		"EditNote (db)":      func() error { _, err := app.EditNote(&json.Note{Id: noteId, Name: "renamed"}, ""); return err },
		"CreateBranch (閉じる)": func() error { _, err := app.CreateBranch("feature"); return err },
	} {
		err := call()
		var me *MessageError
		if !errors.As(err, &me) {
			t.Errorf("%s: err = %v, want *MessageError", name, err)
			continue
		}
		if !errors.Is(err, bfs.ErrReadOnly) && !errors.Is(err, db.ErrReadOnly) {
			t.Errorf("%s: err = %v, want ErrReadOnly", name, err)
		}
		if me.Kind != "warning" {
			t.Errorf("%s: Kind = %q, want warning", name, me.Kind)
		}
	}
}

// 読み取り専用で開いたバインダーを閉じても、ほかのプロセスの「開いている」印に触らないこと。
// 閉じたあとに普通に開き直せること（読み直す・編集できるように開き直すの流れ）。
func TestReadOnlyCloseAndReopen(t *testing.T) {
	const name = "readonly_reopen"
	b := test.CreateBinder(t, name)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	dir := filepath.Join(test.Dir, name)

	app := New(test.LatestVersion.String())
	if _, err := app.LoadBinderReadOnly(dir); err != nil {
		t.Fatalf("LoadBinderReadOnly() error: %v", err)
	}
	// 読み直す
	if _, err := app.LoadBinderReadOnly(dir); err != nil {
		t.Fatalf("2 回目の LoadBinderReadOnly() error: %v", err)
	}
	if !app.IsReadOnly() || openMarked(t, dir) {
		t.Fatalf("読み直したあと: IsReadOnly = %v, 印 = %v", app.IsReadOnly(), openMarked(t, dir))
	}

	// 編集できるように開き直す
	if _, err := app.LoadBinder(dir); err != nil {
		t.Fatalf("LoadBinder() error: %v", err)
	}
	if app.IsReadOnly() || !openMarked(t, dir) {
		t.Fatalf("開き直したあと: IsReadOnly = %v, 印 = %v", app.IsReadOnly(), openMarked(t, dir))
	}
	if err := app.CloseBinder(); err != nil {
		t.Fatalf("CloseBinder() error: %v", err)
	}
	if openMarked(t, dir) {
		t.Error("閉じたあとも印が残っている")
	}
}

// スキーマの移行が要るバインダーは読み取り専用でも開かない。
func TestReadOnlyRefusesMigration(t *testing.T) {
	const name = "readonly_migration"
	b := test.CreateBinder(t, name)
	if err := b.Close(); err != nil {
		t.Fatalf("Close() error: %v", err)
	}
	dir := filepath.Join(test.Dir, name)

	meta, err := bfs.LoadMeta(dir)
	if err != nil {
		t.Fatal(err)
	}
	meta.Version = "0.0.1" // 移行が要るほど古い（移行できる最低より古いものも含めて開かない）
	if err := bfs.SaveMeta(dir, meta); err != nil {
		t.Fatal(err)
	}

	app := New(test.LatestVersion.String())
	_, err = app.LoadBinderReadOnly(dir)
	if err == nil {
		app.CloseBinder()
		t.Fatal("移行が要るバインダーを読み取り専用で開けてしまった")
	}
	if app.current != nil {
		t.Error("開けなかったのに current がある")
	}
}
