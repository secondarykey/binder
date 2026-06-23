import { useRef, useEffect } from "react";

/**
 * オートコンプリート候補リストのフローティングポップアップ
 *
 * Props:
 *   isOpen        - ポップアップを表示するか
 *   items         - 表示する候補一覧（string[] または { label, detail?, args?, returns? }[]）
 *   selectedIndex - 現在選択中のインデックス
 *   position      - { top, left } コンテナ相対座標
 *   onItemClick   - (index) => void  候補クリック時のコールバック
 *   renderItem    - (item, index, isSelected) => ReactNode  カスタムレンダラー（省略時はデフォルト）
 */
function Autocomplete({ isOpen, items, selectedIndex, position, onItemClick, renderItem }) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || !items || items.length === 0 || !position) return null;

  const selectedItem = items[selectedIndex];
  const hasHelp = selectedItem && typeof selectedItem !== 'string' &&
    (selectedItem.args?.length > 0 || selectedItem.returns);

  return (
    <div
      className="editorAutocompleteWrapper"
      style={{ left: position.left + 'px', top: position.top + 'px' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="editorAutocomplete" ref={listRef}>
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const label = typeof item === 'string' ? item : item.label;
          const detail = typeof item === 'string' ? null : item.detail;

          if (renderItem) {
            return (
              <div
                key={idx}
                ref={el => itemRefs.current[idx] = el}
                onClick={() => onItemClick?.(idx)}
              >
                {renderItem(item, idx, isSelected)}
              </div>
            );
          }

          const deprecated = typeof item !== 'string' && item.deprecated;

          return (
            <div
              key={idx}
              ref={el => itemRefs.current[idx] = el}
              className={`editorAutocompleteItem${isSelected ? ' active' : ''}${deprecated ? ' deprecated' : ''}`}
              onClick={() => onItemClick?.(idx)}
            >
              <span className="editorAutocompleteLabel">{label}</span>
              {deprecated && <span className="editorAutocompleteDeprecated">Deprecated</span>}
              {detail && <span className="editorAutocompleteDetail">{detail}</span>}
            </div>
          );
        })}
      </div>

      {hasHelp && (
        <div className="editorAutocompleteHelp">
          <div className="acHelpSig">
            <span className="acHelpName">{selectedItem.label}</span>
            {'('}
            {(selectedItem.args || []).map((a, i) => {
              const optional = a.name.endsWith('?');
              const name = optional ? a.name.slice(0, -1) : a.name;
              return (
                <span key={i} className={optional ? 'acHelpArgOptional' : ''}>
                  {i > 0 && ', '}
                  <span className="acHelpArgName">{name}</span>
                  <span className="acHelpArgType">: {a.type}</span>
                  {optional && <span className="acHelpArgQ">?</span>}
                </span>
              );
            })}
            {')'}
            {selectedItem.returns && <span className="acHelpReturns"> → {selectedItem.returns}</span>}
          </div>
          {selectedItem.detail && (
            <div className="acHelpDetail">{selectedItem.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Autocomplete;
