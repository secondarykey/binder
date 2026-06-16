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
 *
 * @param {{ structure: object|null, onNavigate: (mode: string, id: string) => void }} props
 *   structure: { id, type, name } or null
 */
function IdStatusBar({ structure, onNavigate }) {
  const { t } = useTranslation();

  if (!structure) return null;

  const labelKey = TYPE_LABELS[structure.type] || "editor.idStatus.unknown";
  const label = t(labelKey);
  const urlMode = typeToUrlMode(structure.type);

  return (
    <div id="idStatusBar">
      <span
        className="idStatusLink"
        onClick={() => onNavigate(urlMode, structure.id)}
        title={structure.id}
      >
        {label}: {structure.name || structure.id}
      </span>
    </div>
  );
}

export default IdStatusBar;
