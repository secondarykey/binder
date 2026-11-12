import { useState } from "react";

import { Dialog, DialogActions, DialogTitle } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import UnpublishedIcon from '@mui/icons-material/Unpublished';

import { ParseDiagram, Generate, GenerateAll, GetUnpublishedRefs, Unpublish, EnsureAddress } from "../../../bindings/binder/api/app";
import { Browser } from '@wailsio/runtime';

import Marked from "./engines/Marked.jsx";
import Mermaid from "./engines/Mermaid.jsx";
import { ActionButton } from "../../dialogs/components/ActionButton";
import { usePublishRefsDialog } from "../../dialogs/PublishRefsDialog.jsx";
import { publishWarningMessage } from "../../publish-warning";
import { renderPublishItem, publishComment } from "../../publish-items";
import { Mode } from "../../mode";

/**
 * エディタで開いているものの公開・非公開・ブラウザで開く。
 *
 * 持っている状態はダイアログの開閉だけ（一緒に公開する参照先を選ぶダイアログと、非公開の確認）。
 * ダイアログは `dialogs` で返すので、本体はそれを描画に置く。
 *
 * @param {{
 *   mode: string, id: string, name: string,
 *   text: string,             // 編集中の本文
 *   alias: string,            // 公開先の名前（無ければブラウザで開けない）
 *   styleTemplateId: string,  // 図のスタイルテンプレート
 *   createMarked: (id: string, txt: string, local: boolean) => Promise<{ html: string }>,  // useEditorPreview のもの
 *   evt: object, t: (key: string, opt?: object) => string,
 * }} p
 */
export function useEditorPublish({ mode, id, name, text, alias, styleTemplateId, createMarked, evt, t }) {

  // ノートの公開時に、まだ公開していない参照先を一緒に公開するかを聞くダイアログ
  const [publishRefsDialog, askPublishRefs] = usePublishRefsDialog();

  //出力処理
  const publish = async () => {
    try {
      var elm = "";
      var pluginWarnings = [];
      // 一緒に公開する参照先（図・アセット・レイヤー）
      var refs = [];
      if (mode === Mode.note) {
        // 参照先を調べられなくても公開は止めない（公開時の警告で知らせる）
        const unpublished = await GetUnpublishedRefs(id, text).catch(() => []) ?? [];
        if (unpublished.length > 0) {
          refs = await askPublishRefs(unpublished);
          if (refs === null) return;
        }
        const markedResult = await createMarked(id, text, false);
        elm = markedResult.html;
        // 出力した HTML は git に記録されるため、エンジン／プラグインが効いていないまま
        // 出力したことに気付けるよう明示する（出力自体は止めない）。
        pluginWarnings = Marked.getWarnings(t);
      } else if (mode === Mode.diagram) {
        const diagResult = await ParseDiagram(id, false, text);
        if (diagResult.error) throw new Error(diagResult.error);
        var obj = await Mermaid.parse(diagResult.html, styleTemplateId);
        elm = obj.svg;
      } else if (mode === Mode.template) {
        elm = text;
      } else if (mode === Mode.asset) {
        elm = text;
      }

      // テンプレート関数の警告（未公開データの参照など）。公開後に 404 になる
      // 参照はプレビューでは見えないため、公開したこの時点で知らせる
      let genWarnings;
      if (refs.length > 0) {
        // ノートと参照先を 1 回の記録で公開する。同時に公開するもの同士は未公開の警告にならない
        const items = [{ mode: "note", id, data: elm }];
        for (const r of refs) {
          items.push(await renderPublishItem(r));
        }
        genWarnings = await GenerateAll(items, publishComment([{ type: "note", name }, ...refs]));
      } else {
        genWarnings = await Generate(mode, id, elm);
      }
      evt.reloadUnpublished();
      if (pluginWarnings.length > 0) {
        evt.showWarningMessage(t("plugin.warn.published", { count: pluginWarnings.length }));
      } else if (genWarnings?.length > 0) {
        evt.showWarningMessage(publishWarningMessage(t, genWarnings));
      } else {
        evt.showSuccessMessage("Generate.");
      }
    } catch (err) {
      evt.showErrorMessage(err);
    }
  }

  //非公開処理（確認してから行う）
  const [unpublishConfirm, setUnpublishConfirm] = useState(false);
  const unpublish = () => setUnpublishConfirm(true);
  const doUnpublish = () => {
    setUnpublishConfirm(false);
    Unpublish(mode, id).then(() => {
      evt.reloadUnpublished();
      evt.showSuccessMessage("Unpublish.")
    }).catch((err) => {
      evt.showErrorMessage(err);
    });
  };

  // 公開したものを OS のブラウザで開く
  const openInBrowser = () => {
    if (!alias) return;
    let path = null;
    if (mode === Mode.note) {
      path = id === "index" ? "/" : `/pages/${alias}.html`;
    } else if (mode === Mode.diagram) {
      path = `/images/${alias}.svg`;
    }
    if (!path) return;
    // HTTPサーバを遅延起動してから開く
    EnsureAddress().then((addr) => {
      if (addr) Browser.OpenURL(addr + path);
    }).catch((err) => evt.showErrorMessage(err));
  };

  const dialogs = (
    <>
      {publishRefsDialog}
      {/** 非公開の確認ダイアログ */}
      <Dialog open={unpublishConfirm} onClose={() => setUnpublishConfirm(false)}>
        <DialogTitle>{t("preview.unpublishConfirm")}</DialogTitle>
        <DialogActions>
          <ActionButton variant="cancel" label={t("common.cancel")} icon={<CloseIcon />} onClick={() => setUnpublishConfirm(false)} />
          <ActionButton variant="delete" label={t("preview.unpublish")} icon={<UnpublishedIcon />} onClick={doUnpublish} />
        </DialogActions>
      </Dialog>
    </>
  );

  return { publish, unpublish, openInBrowser, dialogs };
}
