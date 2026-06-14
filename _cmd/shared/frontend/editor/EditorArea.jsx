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
   * 各論理行の「実ピクセル高さ」を算出する（折り返しぶんを含む）。
   *
   * 行番号ガターは論理行ごとに番号を1つ表示し、折り返した継続行は空白に
   * しておく必要がある。その空白量（=行の高さ）を textarea と完全に一致させ
   * ないと番号が累積でずれるため、textarea と同じ内容幅・フォント・折り返し
   * 条件のミラー要素で各論理行の実ピクセル高さを計測し、その値をそのまま
   * ガター行の height に使う（「1行=1.5em」のような決め打ちはしない）。
   */
  const calcLineHeights = useCallback(() => {
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
    // wordWrap OFF（textarea wrap=off）は折り返さないので pre、ON は pre-wrap
    s.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
    s.overflowWrap = 'break-word'; // textarea(wrap=soft) と同様に長い単語も折り返す
    s.wordBreak = cs.wordBreak;

    const lines = text.split('\n');
    // 各行要素を一括追加して reflow を 1 回にする
    const lineEls = lines.map((line) => {
      const d = document.createElement('div');
      d.textContent = line === '' ? '​' : line; // 空行も 1 行分の高さを確保
      mirror.appendChild(d);
      return d;
    });

    document.body.appendChild(mirror);
    // 各論理行の実ピクセル高さ（折り返しぶん込み）をそのまま使う
    const heights = lineEls.map((d) => d.offsetHeight);
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
            // 計測済みなら実ピクセル高さを適用（折り返しぶんの空白を確保）。
            // 未計測の間は自然高さ（1行）で表示し、計測完了後に揃う。
            const h = lineHeights[i];
            return (
              <div key={i} className={`editorLineNumber${activeLine === i + 1 ? ' active' : ''}`} style={h ? { height: `${h}px` } : undefined}>
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
