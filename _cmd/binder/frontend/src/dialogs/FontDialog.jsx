import { useEffect, useState } from "react";
import { GetFontNames } from "../../bindings/binder/api/shared/shared";
import SharedFontDialog from "./components/FontDialog";

import "../language";
import { useTranslation } from 'react-i18next';

/**
 * Binder 本体用フォントダイアログ
 * 共有 FontDialog にフォント名リストとラベルを渡す
 */
export default function FontDialog({ show, font, onClose }) {
  const { t } = useTranslation();
  const [fontNames, setFontNames] = useState([]);

  useEffect(() => {
    GetFontNames().then((names) => {
      setFontNames(names);
    }).catch((err) => {
      console.error('GetFontNames error:', err);
    });
  }, []);

  return (
    <SharedFontDialog
      open={show}
      font={font}
      fontNames={fontNames}
      title={t("font.title")}
      okLabel={t("common.ok")}
      sampleLabel={t("font.sample")}
      labels={{
        name: t("font.name"),
        size: t("font.size"),
        color: t("font.color"),
        backgroundColor: t("font.backgroundColor"),
      }}
      onSave={(f) => onClose(f)}
      onClose={() => onClose()}
    />
  );
}
