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
 * カーソル行の UUID に対応するアイテム情報を表示し、クリックで遷移する。
 * 複数の UUID がある場合は ◀ ▶ で切り替え可能。
 *
 * @param {{ structures: object[], currentIndex: number, onIndexChange: (i: number) => void, onNavigate: (mode: string, id: string) => void }} props
 */
function IdStatusBar({ structures, currentIndex, onIndexChange, onNavigate }) {
  const { t } = useTranslation();

  const visible = structures.length > 0;
  const s = structures[currentIndex] || null;
  const hasMultiple = structures.length > 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    onIndexChange((currentIndex - 1 + structures.length) % structures.length);
  };
  const handleNext = (e) => {
    e.stopPropagation();
    onIndexChange((currentIndex + 1) % structures.length);
  };

  const labelKey = s ? (TYPE_LABELS[s.type] || "editor.idStatus.unknown") : "";
  const label = s ? t(labelKey) : "";
  const urlMode = s ? typeToUrlMode(s.type) : "";

  return (
    <div id="idStatusBar" className={visible ? 'visible' : ''}>
      {s && (
        <>
          {hasMultiple && (
            <span className="idStatusNav">
              <span className="idStatusNavBtn" onClick={handlePrev}>◀</span>
              <span className="idStatusCount">{currentIndex + 1}/{structures.length}</span>
              <span className="idStatusNavBtn" onClick={handleNext}>▶</span>
            </span>
          )}
          <span
            className="idStatusLink"
            onClick={() => onNavigate(urlMode, s.id)}
            title={s.id}
          >
            {label}: {s.name || s.id}
          </span>
        </>
      )}
    </div>
  );
}

export default IdStatusBar;
