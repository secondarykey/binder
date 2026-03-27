import { useRef, useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";

/**
 * 行番号ガター + textarea を一体化したエディタエリアコンポーネント
 *
 * Props:
 *   text            - 表示・編集するテキスト
 *   style           - textarea / 行番号に適用するスタイル（フォント・色など）
 *   showLineNumbers - 行番号ガターを表示するか（デフォルト: true）
 *   wordWrap        - テキスト折り返しを有効にするか（デフォルト: true）
 *   onKeyDown       - キーダウンハンドラ
 *   onChange        - テキスト変更ハンドラ
 *   onDragOver      - ドラッグオーバーハンドラ
 *   onDrop          - ドロップハンドラ
 */
function EditorArea({ text, style, showLineNumbers = true, wordWrap = true, topOffset, onKeyDown, onChange, onCompositionStart, onCompositionEnd, onDragOver, onDrop }) {
  const lineNumbersRef = useRef(null);
  const canvasRef = useRef(null);
  const [lineHeights, setLineHeights] = useState([]);

  /**
   * Canvas でテキスト幅を計測し、各論理行の折り返し visual 行数を算出。
   * wordWrap が OFF の場合は折り返しなしなので全行 1 とする。
   */
  const calcLineHeights = useCallback(() => {
    if (!wordWrap) {
      setLineHeights(text.split('\n').map(() => 1));
      return;
    }

    const textarea = document.querySelector('#editor');
    if (!textarea) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const ctx = canvasRef.current.getContext('2d');
    const cs = window.getComputedStyle(textarea);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const availWidth = textarea.clientWidth - paddingLeft - paddingRight;
    if (availWidth <= 0) return;

    const heights = text.split('\n').map(line => {
      if (line === '') return 1;
      return Math.max(1, Math.ceil(ctx.measureText(line).width / availWidth));
    });
    setLineHeights(heights);
  }, [text, style, wordWrap]);

  // テキスト・フォント・折り返し変更時に再計算
  useEffect(() => {
    calcLineHeights();
  }, [calcLineHeights]);

  // textarea のリサイズ時に再計算（スプリッター操作など）
  useEffect(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    const observer = new ResizeObserver(calcLineHeights);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [calcLineHeights]);

  /**
   * テキストエリアのスクロールに合わせて行番号ガターを同期
   */
  const handleEditorScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const textareaStyle = wordWrap
    ? style
    : { ...style, overflowX: 'auto' };

  return (
    <div className="editorArea" style={topOffset != null ? { top: topOffset + 'px' } : undefined}>
      {showLineNumbers && (
        <div className="editorLineNumbers" ref={lineNumbersRef} style={style}>
          {text.split('\n').map((_, i) => {
            const wraps = lineHeights[i] || 1;
            return (
              <div key={i} className="editorLineNumber" style={{ height: `${wraps * 1.5}em` }}>
                {i + 1}
              </div>
            );
          })}
        </div>
      )}
      <textarea
        id="editor"
        style={textareaStyle}
        wrap={wordWrap ? 'soft' : 'off'}
        value={text}
        onKeyDown={onKeyDown}
        onChange={onChange}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onScroll={handleEditorScroll}
      />
    </div>
  );
}

EditorArea.propTypes = {
  text: PropTypes.string.isRequired,
  style: PropTypes.object,
  showLineNumbers: PropTypes.bool,
  wordWrap: PropTypes.bool,
  topOffset: PropTypes.number,
  onKeyDown: PropTypes.func,
  onChange: PropTypes.func,
  onCompositionStart: PropTypes.func,
  onCompositionEnd: PropTypes.func,
  onDragOver: PropTypes.func,
  onDrop: PropTypes.func,
};

export default EditorArea;
