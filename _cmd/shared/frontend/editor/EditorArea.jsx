import { useRef, useState, useCallback, useEffect } from "react";

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
function EditorArea({ text, style, showLineNumbers = true, wordWrap = true, activeLine, onKeyDown, onChange, onPaste, onCursorMove, onCompositionStart, onCompositionEnd, onDragOver, onDrop }) {
  const lineNumbersRef = useRef(null);
  const [lineHeights, setLineHeights] = useState([]);
  // エディタがまだサイズ未確定（幅0）で計測できない時のリトライ回数
  const retryRef = useRef(0);

  /**
   * 各論理行が折り返しで何 visual 行になるかを算出する。
   * wordWrap が OFF の場合は折り返しなしなので全行 1 とする。
   *
   * textarea と同じ内容幅・フォント・折り返し条件のミラー要素で実測する。
   * canvas の ceil(行幅 / 利用幅) 近似は単語折り返しを過小評価し、長い行で
   * ガターが実テキストより短くなって行番号がずれる（最終行が表示されない）
   * 原因になるため、実DOMの折り返し結果を計測する方式にしている。
   */
  const calcLineHeights = useCallback(() => {
    if (!wordWrap) {
      setLineHeights(text.split('\n').map(() => 1));
      return;
    }

    const textarea = document.querySelector('#editor');
    const cs = textarea ? window.getComputedStyle(textarea) : null;
    const paddingLeft = cs ? (parseFloat(cs.paddingLeft) || 0) : 0;
    const paddingRight = cs ? (parseFloat(cs.paddingRight) || 0) : 0;
    const availWidth = textarea ? textarea.clientWidth - paddingLeft - paddingRight : 0;

    // エディタがまだレイアウトされていない（幅0）と計測できず lineHeights が
    // 空のままになり、折り返しのスペーサーが入らず番号がずれる。測れるように
    // なるまで次フレームで再試行する（上限付きで無限ループを防ぐ）。
    if (!textarea || availWidth <= 0) {
      if (retryRef.current < 60) {
        retryRef.current++;
        requestAnimationFrame(() => calcRef.current());
      }
      return;
    }
    retryRef.current = 0;

    // textarea の内容幅・折り返し条件を再現するミラー
    const mirror = document.createElement('div');
    const s = mirror.style;
    s.position = 'absolute';
    s.top = '-9999px';
    s.left = '-9999px';
    s.visibility = 'hidden';
    s.boxSizing = 'content-box';
    s.padding = '0';
    s.border = '0';
    s.width = availWidth + 'px';
    s.height = 'auto';
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
      'letterSpacing', 'textTransform', 'tabSize'].forEach((p) => { s[p] = cs[p]; });
    s.whiteSpace = 'pre-wrap';
    s.overflowWrap = 'break-word'; // textarea(wrap=soft) と同様に長い単語も折り返す
    s.wordBreak = cs.wordBreak;

    const lines = text.split('\n');
    // 1 visual 行の高さ基準（プローブ）と各行要素を一括追加し reflow を 1 回にする
    const probe = document.createElement('div');
    probe.textContent = 'X';
    mirror.appendChild(probe);
    const lineEls = lines.map((line) => {
      const d = document.createElement('div');
      d.textContent = line === '' ? '​' : line; // 空行も 1 行分の高さを確保
      mirror.appendChild(d);
      return d;
    });

    document.body.appendChild(mirror);
    const unit = probe.offsetHeight || 1;
    const heights = lineEls.map((d) => Math.max(1, Math.round(d.offsetHeight / unit)));
    document.body.removeChild(mirror);

    setLineHeights(heights);
  }, [text, style, wordWrap]);

  // 全行の measureText は重いため、連続入力・連続リサイズでは rAF で 1 フレーム 1 回に間引く。
  // rAF はスケジュール時点のクロージャを実行するため、コアレッシングで最新の計算関数を
  // 取りこぼさないよう ref 経由で常に最新の calcLineHeights を呼ぶ。
  const calcRef = useRef(calcLineHeights);
  calcRef.current = calcLineHeights;

  const rafRef = useRef(0);
  const scheduleCalc = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      calcRef.current();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // テキスト・フォント・折り返し変更時に再計算
  useEffect(() => {
    scheduleCalc();
  }, [text, style, wordWrap, scheduleCalc]);

  // textarea のリサイズ時に再計算（スプリッター操作など）
  useEffect(() => {
    const textarea = document.querySelector('#editor');
    if (!textarea) return;
    const observer = new ResizeObserver(scheduleCalc);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [scheduleCalc]);

  /**
   * テキストエリアのスクロールに合わせて行番号ガターを同期
   */
  const handleEditorScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const textareaStyle = wordWrap
    ? { ...style, whiteSpace: 'pre-wrap' }
    : { ...style, whiteSpace: 'pre', overflowX: 'auto' };

  return (
    <div className="editorArea">
      {showLineNumbers && (
        <div className="editorLineNumbers" ref={lineNumbersRef} style={style}>
          {text.split('\n').map((_, i) => {
            const wraps = lineHeights[i] || 1;
            return (
              <div key={i} className={`editorLineNumber${activeLine === i + 1 ? ' active' : ''}`} style={{ height: `${wraps * 1.5}em` }}>
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
        onPaste={onPaste}
        onClick={onCursorMove}
        onKeyUp={onCursorMove}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onScroll={handleEditorScroll}
      />
    </div>
  );
}

export default EditorArea;
