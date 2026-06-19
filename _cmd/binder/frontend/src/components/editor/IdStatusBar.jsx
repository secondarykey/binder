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
 * 関数ヒント（左）と ID 情報（右）を同時表示可能。
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
    const activeArg = funcHint.activeArg ?? -1;
    const ret = funcHint.returns ? ` → ${funcHint.returns}` : '';
    return (
      <span className="funcHintSection">
        <span className="funcHintName">{funcHint.label}</span>
        <span className="funcHintSig">
          {'('}
          {args.map((a, i) => {
            const optional = a.name.endsWith('?');
            const name = optional ? a.name.slice(0, -1) : a.name;
            const active = i === activeArg;
            return (
              <span key={i} className={
                (optional ? 'funcHintArgOptional' : '') +
                (active ? ' funcHintArgActive' : '')
              }>
                {i > 0 && ', '}
                <span className="funcHintArgName">{name}</span>
                <span className="funcHintArgType">: {a.type}</span>
                {optional && <span className="funcHintArgQ">?</span>}
              </span>
            );
          })}
          {')'}
          {ret}
        </span>
      </span>
    );
  };

  const renderIdInfo = () => {
    if (!hasId || !s) return null;
    return (
      <span className="idInfoSection">
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
      </span>
    );
  };

  return (
    <div id="idStatusBar" className={visible ? 'visible' : ''}>
      {renderFuncHint()}
      {funcHint && hasId && <span className="statusBarDivider" />}
      {renderIdInfo()}
    </div>
  );
}

export default IdStatusBar;
