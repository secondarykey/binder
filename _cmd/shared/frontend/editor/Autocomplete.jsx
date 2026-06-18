import { useRef, useEffect } from "react";

/**
 * オートコンプリート候補リストのフローティングポップアップ
 *
 * Props:
 *   isOpen        - ポップアップを表示するか
 *   items         - 表示する候補一覧（string[] または { label, detail? }[]）
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

  return (
    <div
      className="editorAutocomplete"
      ref={listRef}
      style={{ left: position.left + 'px', top: position.top + 'px' }}
      onMouseDown={(e) => e.preventDefault()}
    >
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

        return (
          <div
            key={idx}
            ref={el => itemRefs.current[idx] = el}
            className={`editorAutocompleteItem${isSelected ? ' active' : ''}`}
            onClick={() => onItemClick?.(idx)}
          >
            <span className="editorAutocompleteLabel">{label}</span>
            {detail && <span className="editorAutocompleteDetail">{detail}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default Autocomplete;
