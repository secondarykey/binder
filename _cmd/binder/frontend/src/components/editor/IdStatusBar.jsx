import { useTranslation } from 'react-i18next';
import "../../language";

const TYPE_LABELS = {
  note: "editor.idStatus.note",
  diagram: "editor.idStatus.diagram",
  asset: "editor.idStatus.asset",
  layer: "editor.idStatus.layer",
};

function typeToUrlMode(typ) {
  if (typ === 'asset') return 'assets';
  return typ;
}

/**
 * エディタ下部の ID ステータスバー。
 * カーソル位置の UUID に対応するアイテム情報を表示し、クリックで遷移する。
 * 常にマウントし、CSS transition で表示/非表示をアニメーションする。
 *
 * @param {{ structure: object|null, onNavigate: (mode: string, id: string) => void }} props
 *   structure: { id, type, name } or null
 */
function IdStatusBar({ structure, onNavigate }) {
  const { t } = useTranslation();

  const visible = !!structure;
  const labelKey = structure ? (TYPE_LABELS[structure.type] || "editor.idStatus.unknown") : "";
  const label = structure ? t(labelKey) : "";
  const urlMode = structure ? typeToUrlMode(structure.type) : "";

  return (
    <div id="idStatusBar" className={visible ? 'visible' : ''}>
      {structure && (
        <span
          className="idStatusLink"
          onClick={() => onNavigate(urlMode, structure.id)}
          title={structure.id}
        >
          {label}: {structure.name || structure.id}
        </span>
      )}
    </div>
  );
}

export default IdStatusBar;
