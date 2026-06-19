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
 * エディタ下部のステータスバー。
 * カーソル行の UUID に対応するアイテム情報、またはテンプレート関数ヒントを表示する。
 * ID情報が優先。ID がない場合に funcHint を表示する。
 *
 * @param {{ structures: object[], currentIndex: number, onIndexChange: (i: number) => void, onNavigate: (mode: string, id: string) => void, funcHint: object|null }} props
 */
function IdStatusBar({ structures, currentIndex, onIndexChange, onNavigate, funcHint }) {
  const { t } = useTranslation();

  const hasId = structures.length > 0;
  const visible = hasId || !!funcHint;
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

  const renderFuncHint = () => {
    if (!funcHint) return null;
    const args = funcHint.args || [];
    const sig = args.length > 0
      ? `(${args.map(a => a.name).join(', ')})`
      : '()';
    const ret = funcHint.returns ? ` → ${funcHint.returns}` : '';
    return (
      <>
        <span className="funcHintName">{funcHint.label}</span>
        <span className="funcHintSig">{sig}{ret}</span>
        <span className="funcHintDetail">{funcHint.detail}</span>
      </>
    );
  };

  return (
    <div id="idStatusBar" className={visible ? 'visible' : ''}>
      {hasId && s && (
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
      {!hasId && funcHint && renderFuncHint()}
    </div>
  );
}

export default IdStatusBar;
