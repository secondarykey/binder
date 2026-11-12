import { useState } from "react";

import { GetHTMLTemplates, GetBinderTree } from "../../../bindings/binder/api/app";
import { flattenNotes, flattenDiagrams } from "./tree-flatten";

// テンプレートプレビューで前回選択したノート・テンプレート・ダイアグラムを記憶する
// （エディタを開き直しても残るよう、モジュールの変数に置く）
let lastPreviewNoteId = "";
let lastPreviewOtherTemplateId = "";
let lastPreviewDiagramId = "";

/**
 * テンプレートを編集するときの、プレビューに使う相手（ノート・もう一方のテンプレート・ダイアグラム）の
 * 一覧と選択。
 *
 * layout / content のテンプレートは「ノート」と「もう一方のテンプレート」を、
 * diagram のテンプレートは「ダイアグラム」を選んでプレビューする。
 * 選んだものは覚えておき、次に開いたときに一覧に残っていれば同じものを選ぶ。
 *
 * @param {{ onError: (err: any) => void }} p
 */
export function useTemplatePreviewTargets({ onError }) {
  const [layouts, setLayouts] = useState([]);
  const [contents, setContents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteId, setNoteId] = useState("");
  const [otherTemplateId, setOtherTemplateId] = useState("");
  const [diagrams, setDiagrams] = useState([]);
  const [diagramId, setDiagramId] = useState("");

  /**
   * 一覧を読み込み、ノートとダイアグラムの選択を決める。
   * テンプレートの種類が決まる前に呼ぶので、テンプレートの一覧とツリーの両方を取る
   */
  const load = () => {
    GetHTMLTemplates().then((tmpls) => {
      setLayouts(tmpls.layouts ?? []);
      setContents(tmpls.contents ?? []);
    }).catch(onError);

    GetBinderTree().then((tree) => {
      // ノート一覧（layout/content テンプレート用）
      const ns = flattenNotes(tree.data ?? []);
      setNotes(ns);
      if (ns.length > 0) {
        const restored = lastPreviewNoteId && ns.some(n => n.id === lastPreviewNoteId);
        setNoteId(restored ? lastPreviewNoteId : ns[0].id);
      }
      // ダイアグラム一覧（diagram テンプレート用）
      const ds = flattenDiagrams(tree.data ?? []);
      setDiagrams(ds);
      if (ds.length > 0) {
        const restored = lastPreviewDiagramId && ds.some(d => d.id === lastPreviewDiagramId);
        setDiagramId(restored ? lastPreviewDiagramId : ds[0].id);
      }
    }).catch(onError);
  };

  /**
   * 「もう一方のテンプレート」（layout を編集中なら content、それ以外なら layout）の一覧
   */
  const otherTemplates = (templateType) => (templateType === "layout" ? contents : layouts);

  /**
   * テンプレートの種類が決まったら、「もう一方のテンプレート」の選択を決める（前回の選択があれば戻す）
   */
  const selectDefaultOtherTemplate = (templateType) => {
    const others = otherTemplates(templateType);
    if (others.length > 0) {
      const restored = lastPreviewOtherTemplateId && others.some(o => o.id === lastPreviewOtherTemplateId);
      setOtherTemplateId(restored ? lastPreviewOtherTemplateId : others[0].id);
    }
  };

  /** 前のテンプレートの選択が残ると古いプレビューが出るので、開く前に外す */
  const clearOtherTemplate = () => setOtherTemplateId("");

  // 選び直し（選んだものを覚えておく）
  const changeNote = (v) => { lastPreviewNoteId = v; setNoteId(v); };
  const changeOtherTemplate = (v) => { lastPreviewOtherTemplateId = v; setOtherTemplateId(v); };
  const changeDiagram = (v) => { lastPreviewDiagramId = v; setDiagramId(v); };

  return {
    layouts, contents, notes, noteId, otherTemplateId, diagrams, diagramId,
    load, otherTemplates, selectDefaultOtherTemplate, clearOtherTemplate,
    changeNote, changeOtherTemplate, changeDiagram,
  };
}
