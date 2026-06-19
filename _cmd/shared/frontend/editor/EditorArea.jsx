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
  // 各論理行が折り返しで何 visual 行になるか（折り返し行数）。
  const [lineWraps, setLineWraps] = useState([]);
  // エディタがまだサイズ未確定（幅0）で計測できない時のリトライ回数
  const retryRef = useRef(0);

  /**
   * 各論理行の折り返し行数を算出する。
   *
   * 行番号ガターは visual 行ごとに1行を描画し、論理行の先頭 visual 行に番号を、
   * 折り返した継続行は空白を表示する（例: 5行のうち3行目だけ折り返す場合、
   * 表示は6 visual 行で行番号は「1 2 3 空 4 5」）。各ガター行は textarea と同じ
   * 自然な行高で並ぶため、textarea の各行と 1 対 1 で揃う（高さの決め打ちなし）。
   *
   * 折り返し行数は textarea と同じ内容幅・フォント・折り返し条件のミラーで実測する。
   */
  const calcLineWraps = useCallback(() => {
    // wordWrap OFF は折り返さないので全行 1（計測不要）
    if (!wordWrap) {
      retryRef.current = 0;
      setLineWraps(text.split('\n').map(() => 1));
      return;
    }

    const textarea = document.querySelector('#editor');
    const cs = textarea ? window.getComputedStyle(textarea) : null;

    const paddingLeft = cs ? (parseFloat(cs.paddingLeft) || 0) : 0;
    const paddingRight = cs ? (parseFloat(cs.paddingRight) || 0) : 0;
    const availWidth = textarea ? textarea.clientWidth - paddingLeft - paddingRight : 0;

    // エディタがまだレイアウトされていない（幅0）と計測できないので、測れるように
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
    const wraps = lineEls.map((d) => Math.max(1, Math.round(d.offsetHeight / unit)));
    document.body.removeChild(mirror);

    setLineWraps(wraps);
  }, [text, style, wordWrap]);

  // 計測は重いため、連続入力・連続リサイズでは rAF で 1 フレーム 1 回に間引く。
  // rAF はスケジュール時点のクロージャを実行するため、コアレッシングで最新の計算関数を
  // 取りこぼさないよう ref 経由で常に最新の calcLineWraps を呼ぶ。
  const calcRef = useRef(calcLineWraps);
  calcRef.current = calcLineWraps;

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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        // cancel 後に必ず 0 へ戻す。戻さないと StrictMode の mount→unmount→remount や
        // 再マウント時に rafRef が予約IDのまま固着し、scheduleCalc が永久に
        // early-return して計測（calc）が一度も走らなくなる。
        rafRef.current = 0;
      }
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
          {text.split('\n').flatMap((_, i) => {
            // 論理行の折り返し行数ぶん visual 行を出す。先頭行に番号、
            // 折り返した継続行は空白（&nbsp;）にして textarea の各行と 1 対 1 で揃える。
            const wraps = lineWraps[i] || 1;
            return Array.from({ length: wraps }, (_, r) => (
              <div
                key={`${i}_${r}`}
                className={`editorLineNumber${r === 0 && activeLine === i + 1 ? ' active' : ''}`}
              >
                {r === 0 ? i + 1 : ' '}
              </div>
            ));
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
