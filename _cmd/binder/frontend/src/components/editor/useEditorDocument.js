import { useState, useEffect, useLayoutEffect, useRef } from "react";

import { GetNote, OpenNote, GetDiagram, OpenDiagram, GetTemplate, OpenTemplate, GetAsset, GetLayer } from "../../../bindings/binder/api/app";
import { Events } from '@wailsio/runtime';

import Mermaid from "./engines/Mermaid.jsx";
import { runTemplatePreview } from "./preview-run";
import { useEditorPreview } from "./useEditorPreview";
import { useTemplatePreviewTargets } from "./useTemplatePreviewTargets";
import { Mode } from "../../mode";

/**
 * エディタで開いているもの: 本文・名前などの読み込みと、プレビューを作るタイミング。
 *
 * 流れ:
 *   1. id（か restoredAt）が変わる → useEffect([id, restoredAt]) が種類ごとの読み込みを始める。
 *      読んでいる間は loadingRef を立て、前の本文を出したままにする（同じ種類へ移るとき。空を挟むと点滅する）
 *   2. 読み終える → setText と setOpenSeq → useEffect([text, openSeq]) がすぐプレビューを作る
 *   3. 入力（editText）→ useEffect([text, openSeq]) が 500ms デバウンスしてプレビューを作る
 *
 * **useEffect の並び順に意味がある**。この中の useEffect は上から、
 * （useEditorPreview の中の 1 つ）→ 開く → テンプレートのプレビュー 4 つ → 本文が変わったとき → 開き終えたとき、の順。
 * ref（loadingRef / fileOpeningRef / isEditingRef / parseTimerRef / diagramInitializedRef）を
 * 複数の useEffect が順に見ているので、入れ替えたり間に足したりするときは画面で確かめる。
 * 呼ぶ側は、modeRef / idRef を合わせる useEffect より後ろでこのフックを呼ぶ。
 *
 * @param {{
 *   mode: string, id: string,
 *   restoredAt: any,                     // 履歴から復元した時刻。変わったら同じ id でも読み直す
 *   idRef: { current: string },          // いま開いている ID（読んでいる間・変換している間に別のものを開いたら結果を捨てる）
 *   cursorLineRef: { current: number }, setCursorLine: (line: number) => void,
 *   setAlertsAvailable: (v: boolean) => void,
 *   setEditor: (v: boolean) => void,     // エディタを出すか（アセット・レイヤーでは出さない）
 *   setViewer: (v: boolean) => void,     // プレビューを出すか
 *   editorSettingRef: { current: object|null },  // エディタ設定。showPreview でプレビューの表示を戻す
 *   evt: object, t: (key: string) => string,
 * }} p
 */
export function useEditorDocument({
  mode, id, restoredAt, idRef, cursorLineRef, setCursorLine, setAlertsAvailable,
  setEditor, setViewer, editorSettingRef, evt, t,
}) {

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  //更新状態のアイコン
  const [updated, setUpdated] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [alias, setAlias] = useState('');
  // ダイアグラムスタイルテンプレートID
  const [styleTemplateId, setStyleTemplateId] = useState("");
  // 編集中のテンプレートの種類（layout / content / diagram）
  const [templateType, setTemplateType] = useState("");

  // ダイアグラムテンプレートの初回描画済みIDを記録（非同期レース対策）
  const diagramInitializedRef = useRef(null);
  // ファイルオープン中フラグ（カーソル/スクロール位置リセット用）
  const fileOpeningRef = useRef(false);
  // 非同期ロード前のリセット中フラグ（空テキストでのparseText発火を抑制）。
  // 立っている間は、呼ぶ側も入力と挿入を受け付けない
  const loadingRef = useRef(false);
  // 開き終えた回数。同じ種類のまま開き直すときは前の本文を出したままにする（空を挟むと点滅する）ので、
  // 本文が前と同じでも描画し直せるよう、useEffect([text]) をこれでも起こす
  const [openSeq, setOpenSeq] = useState(0);
  // 直前に開いていたものの種類（種類が変わるときだけ本文を空に戻す）
  const openedModeRef = useRef(null);

  // ユーザーがテキストを入力中かどうかのフラグ / デバウンスタイマー
  // editText だけが true にセットする。ファイルオープン時はセットされないので即時描画になる。
  const isEditingRef = useRef(false);
  const parseTimerRef = useRef(null);

  /**
   * 入力中として本文を差し替える（打鍵・貼り付け・Enter / Tab などのキー操作）。
   * プレビューは 500ms デバウンスして作る。すぐ作り直したいとき（挿入など）は setText を使う
   */
  const editText = (txt) => {
    isEditingRef.current = true;
    setText(txt);
  };

  // テンプレートのプレビューに使う相手（ノート・もう一方のテンプレート・ダイアグラム）の一覧と選択
  const targets = useTemplatePreviewTargets({ onError: (err) => evt.showErrorMessage(err) });
  const { noteId: previewNoteId, otherTemplateId: previewOtherTemplateId, diagramId: previewDiagramId } = targets;

  // プレビューの生成。出している HTML（html）と変換の結果（parseStatus）はここが持つ。
  // いつ作るか（開いた直後・入力中のデバウンス）は、下の useEffect([text, openSeq]) が決める
  const {
    html, setHTML, htmlRef, parseStatus, setParseStatus,
    parseText, createMarked, viewDiagramTemplatePreview,
  } = useEditorPreview({
    mode, id, name, text, idRef, cursorLineRef, setCursorLine, setAlertsAvailable,
    styleTemplateId, templateType, previewNoteId, previewOtherTemplateId, previewDiagramId,
    evt, t,
  });

  // ---- 開いたときの読み込み（種類ごと） ----
  // 下の useEffect([id, restoredAt]) から呼ぶ。その描画の id を見る

  // 本文が空のときのステータス
  const emptyStatus = () => ({ status: "error", err: t("preview.emptyContent"), errorLine: 1, warnings: [] });

  /**
   * 本文を編集する種類（ノート・図・テンプレート）を開く前の準備。
   * text の差し替えは非同期の読み込みのあとなので、それまで useEffect([text]) でプレビューを作らせない
   * （これが無いと、空の本文でのエラーや前のファイルのエラー行が、読み終えるまで残る）
   */
  const beginOpenText = () => {
    setEditor(true);
    // assets/layer モードから戻った場合に viewer 状態を復元する
    if (editorSettingRef.current) {
      setViewer(editorSettingRef.current.showPreview);
    }
    loadingRef.current = true;
    setParseStatus({ status: "processing", err: null, warnings: [] });
  };

  /** 図を開く */
  const openDiagram = () => {
    beginOpenText();
    // 図から図へ移るときは前の本文と図を出したままにし、読み終えてから差し替える。
    // 種類が変わるときは #mermaidViewer が作り直されるので、text を一旦空にして
    // 読み終えたときに必ず useEffect([text]) が発火するようにする
    if (openedModeRef.current !== Mode.diagram) setText("");

    // メタ情報取得 → スタイルテンプレートキャッシュ → テキスト設定の順に実行
    // setText が先に走ると styleTemplateId が空のまま初回描画されるため
    const metaReady = GetDiagram(id).then(async (resp) => {
      setUpdated(resp.updatedStatus > 0);
      setIsPrivate(!!resp.private);
      setAlias(resp.alias ?? '');
      setName(resp.name);
      setStyleTemplateId(resp.styleTemplate || "");
      if (resp.styleTemplate) {
        if (Mermaid.hasStyleTemplate(resp.styleTemplate)) {
          // キャッシュ済みなら描画をブロックせずバックグラウンドで最新内容に更新する
          OpenTemplate(resp.styleTemplate).then((content) => {
            Mermaid.setStyleTemplate(resp.styleTemplate, content);
          }).catch(() => {});
        } else {
          // 初回はスタイル欠落した描画を防ぐため取得完了を待つ
          const content = await OpenTemplate(resp.styleTemplate).catch(() => "");
          Mermaid.setStyleTemplate(resp.styleTemplate, content);
        }
      }
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    Promise.all([OpenDiagram(id), metaReady]).then(([diagramText]) => {
      // 読んでいる間に別のものを開いていたら捨てる
      if (idRef.current !== id) return;
      loadingRef.current = false;
      fileOpeningRef.current = true;
      if (diagramText === "") {
        setParseStatus(emptyStatus());
        const mermaidEl = document.querySelector('#mermaidViewer');
        if (mermaidEl) mermaidEl.innerHTML = '';
      }
      setText(diagramText);
      setOpenSeq((n) => n + 1);
    }).catch((err) => {
      // 前の図の本文を、開けなかった図のものとして出したままにしない
      if (idRef.current === id) setText("");
      evt.showErrorMessage(err);
    })
  };

  /** ノートを開く */
  const openNote = () => {
    beginOpenText();
    // ノートからノートへ移るときは前の本文とプレビューを出したままにし、読み終えてから差し替える
    // （空の本文を挟むと、エディタと行番号が一瞬消えて点滅して見える）
    if (openedModeRef.current !== Mode.note) setText("");

    OpenNote(id).then((resp) => {
      // 読んでいる間に別のものを開いていたら捨てる
      if (idRef.current !== id) return;
      loadingRef.current = false;
      fileOpeningRef.current = true;
      // プレビューは新しいノートの先頭から見せる
      cursorLineRef.current = 1;
      if (resp === "") {
        // ""→"" では useEffect([text]) が発火しないため、ここで直接確定する
        setParseStatus(emptyStatus());
        setHTML("");
      }
      setText(resp);
      setOpenSeq((n) => n + 1);
    }).catch((err) => {
      // 前のノートの本文を、開けなかったノートのものとして出したままにしない
      if (idRef.current === id) setText("");
      evt.showErrorMessage(err);
    });

    GetNote(id).then((resp) => {
      setUpdated(resp.updatedStatus > 0);
      setIsPrivate(!!resp.private);
      setAlias(resp.alias ?? '');
      setName(resp.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  };

  /** テンプレートを開く */
  const openTemplate = () => {
    beginOpenText();
    // プレビュー設定を初期化（前回の選択があれば復元）
    setHTML("");
    setText("");                   // 非同期ロード前にリセット（初回描画ガード用）
    setTemplateType("");          // 前テンプレートの型が残ると stale preview が発生するためリセット
    targets.clearOtherTemplate(); // 同上
    diagramInitializedRef.current = null; // 同一IDへの再訪問に備えてリセット

    OpenTemplate(id).then((resp) => {
      loadingRef.current = false;
      fileOpeningRef.current = true;
      if (resp === "") {
        setParseStatus(emptyStatus());
      }
      setText(resp);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    GetTemplate(id).then((resp) => {
      setUpdated(resp.updatedStatus > 0);
      setName(resp.name);
      setTemplateType(resp.type);
    }).catch((err) => {
      evt.showErrorMessage(err);
    });

    // プレビュー用データを取得（テンプレートタイプ確定後に分岐するため、ここではツリーとテンプレート一覧を両方取得）
    targets.load();
  };

  /**
   * アセット・レイヤーを開く。表示と操作は AssetViewer / LayerEditor が担うので、
   * エディタとプレビューは出さず、名前などだけを読む
   */
  const openWithoutEditor = (getMeta) => {
    setEditor(false);
    setViewer(false);
    getMeta(id).then((resp) => {
      setUpdated(resp.updatedStatus > 0);
      setIsPrivate(!!resp.private);
      setName(resp.name);
    }).catch((err) => {
      evt.showErrorMessage(err);
    })
  };

  //開いた時の初期処理
  useEffect(() => {

    // モード切替時のエディタ/ビューア開閉でアニメーションさせない
    const editorContentEl = document.getElementById('editorContent');
    editorContentEl?.classList.add('no-transition');

    evt.clearMessage();
    // モード/ID切替時に前回のデバウンスタイマーをクリア（stale closure 防止）
    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
      parseTimerRef.current = null;
    }
    // ツリー選択を同期（画像貼り付け・ツリー展開に必要）
    evt.selectTreeNode(id);

    if (mode === Mode.diagram) {
      openDiagram();
    } else if (mode === Mode.note) {
      openNote();
    } else if (mode === Mode.template) {
      openTemplate();
    } else if (mode === "assets") {
      openWithoutEditor(GetAsset);
    } else if (mode === "layer") {
      openWithoutEditor(GetLayer);
    }

    openedModeRef.current = mode;

    // レイアウト反映後にtransitionを再有効化（二重rAFでReact再描画完了を待つ）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editorContentEl?.classList.remove('no-transition');
      });
    });

  }, [id, restoredAt]);

  // templateType が確定したら「もう一方のテンプレート」のデフォルトを設定（前回選択があれば復元）
  useEffect(() => {
    if (!templateType) return;
    targets.selectDefaultOtherTemplate(templateType);
  }, [templateType, targets.layouts, targets.contents]);

  // プレビュー設定が揃ったら自動プレビュー（layout/content テンプレート）
  useEffect(() => {
    if (mode !== Mode.template || templateType === "diagram" || !previewNoteId || !previewOtherTemplateId || !templateType) return;
    runTemplatePreview(id, templateType, previewOtherTemplateId, previewNoteId)
      .then((result) => {
        const ws = result.warnings || [];
        if (result.error) {
          evt.showErrorMessage(result.error);
        } else {
          setHTML(result.html);
          setParseStatus(ws.length > 0 ? { status: "warning", err: null, warnings: ws } : { status: "success", err: null, warnings: [] });
          Events.Emit('binder:preview:update', { typ: 'template', id, name, html: result.html });
        }
      })
      .catch((err) => evt.showErrorMessage(err));
  }, [previewNoteId, previewOtherTemplateId]);

  // ダイアグラムテンプレート: 初回表示（text/templateType/previewDiagramId の非同期到達レース解消）
  // text が最後に届くケースも含めて全条件が揃った瞬間に一度だけ描画する
  useEffect(() => {
    if (mode !== Mode.template || templateType !== "diagram" || !previewDiagramId || !text) return;
    if (diagramInitializedRef.current === id) return;
    diagramInitializedRef.current = id;
    viewDiagramTemplatePreview(text, previewDiagramId);
  }, [previewDiagramId, templateType, text]);

  // ダイアグラムテンプレート: 選択ダイアグラム変更時の再描画（初回ロード完了後のみ）
  useEffect(() => {
    if (mode !== Mode.template || templateType !== "diagram" || !previewDiagramId || !text) return;
    if (diagramInitializedRef.current !== id) return;
    viewDiagramTemplatePreview(text, previewDiagramId);
  }, [previewDiagramId]);

  //テキスト変更時の処理
  // handleChangeText（ユーザー入力）→ isEditingRef=true → デバウンス
  // ファイルオープン時は isEditingRef が false のまま → 即時描画
  useEffect(() => {
    if (isEditingRef.current) {
      // ユーザーが入力中 → 500msデバウンスして描画
      isEditingRef.current = false;
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      parseTimerRef.current = setTimeout(() => { parseText().catch((err) => evt.showErrorMessage(err)); }, 500);
      return () => clearTimeout(parseTimerRef.current);
    }
    // 非同期ロード前のリセット中は parseText を呼ばない（フラッシュ防止）
    if (loadingRef.current) return;
    // ファイルオープン時（または挿入操作） → 即座に描画
    // 空テキストでも parseText を通してプレビューをクリアする
    // （ダイアグラム等で前の表示が残る問題の防止）

    // ファイルオープン時: カーソルを先頭に戻しスクロール位置をリセット
    // React の controlled textarea は value 更新時にカーソルを末尾に移動するため、
    // それによる自動スクロール（末尾へのジャンプ）を防ぐ
    if (fileOpeningRef.current) {
      fileOpeningRef.current = false;
      requestAnimationFrame(() => {
        const textarea = document.querySelector('#editor');
        if (textarea) {
          textarea.setSelectionRange(0, 0);
          textarea.scrollTop = 0;
        }
      });
    }

    parseText().catch((err) => evt.showErrorMessage(err));
  }, [text, openSeq]);

  // 開き終えたら、描画の前にカーソルとスクロールを先頭へ戻す
  // （前の本文を出したまま差し替えるので、描画のあとに戻すと前のスクロール位置が一瞬見える）
  useLayoutEffect(() => {
    if (!openSeq) return;
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    textarea.setSelectionRange(0, 0);
    textarea.scrollTop = 0;
  }, [openSeq]);

  return {
    text, setText, editText, loadingRef,
    name, updated, setUpdated, isPrivate, alias, styleTemplateId, templateType,
    html, htmlRef, parseStatus, createMarked, targets,
  };
}
