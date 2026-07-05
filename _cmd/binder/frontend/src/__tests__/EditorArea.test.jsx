import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import EditorArea from '@shared/editor/EditorArea';

describe('EditorArea', () => {
  it('renders a textarea with the provided text', () => {
    render(<EditorArea text="Hello World" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument();
  });

  it('renders line numbers by default', () => {
    render(<EditorArea text={"line1\nline2\nline3"} onChange={() => {}} />);
    const { container } = render(<EditorArea text={"a\nb\nc"} onChange={() => {}} />);
    const lineNumbers = container.querySelector('.editorLineNumbers');
    expect(lineNumbers).toBeInTheDocument();
  });

  it('hides line numbers when showLineNumbers is false', () => {
    const { container } = render(<EditorArea text="line1" showLineNumbers={false} onChange={() => {}} />);
    expect(container.querySelector('.editorLineNumbers')).toBeNull();
  });
});

describe('EditorArea line wrap cache', () => {
  // jsdom はレイアウトを持たないため、計測に使う clientWidth / offsetHeight をスタブし、
  // 折り返し計測（ミラー DOM の body への appendChild）が走ったかどうかで検証する
  let rafQueue;
  let width;
  const origClientWidth = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'clientWidth');
  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

  beforeEach(() => {
    rafQueue = [];
    width = 400;
    vi.stubGlobal('requestAnimationFrame', (cb) => { rafQueue.push(cb); return rafQueue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 20 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (origClientWidth) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', origClientWidth);
    } else {
      delete HTMLTextAreaElement.prototype.clientWidth;
    }
    if (origOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
    } else {
      delete HTMLElement.prototype.offsetHeight;
    }
  });

  const flushRaf = () => {
    while (rafQueue.length) {
      const q = rafQueue;
      rafQueue = [];
      q.forEach((cb) => act(() => { cb(); }));
    }
  };

  it('does not re-measure lines already in the cache', () => {
    const { rerender } = render(<EditorArea text={"aaa\nbbb"} onChange={() => {}} />);
    flushRaf();

    const spy = vi.spyOn(document.body, 'appendChild');
    // 既存行の並び替え・複製のみ → 全行キャッシュ済みでミラー計測は走らない
    rerender(<EditorArea text={"bbb\naaa\nbbb"} onChange={() => {}} />);
    flushRaf();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('measures only lines missing from the cache', () => {
    const { rerender } = render(<EditorArea text={"aaa"} onChange={() => {}} />);
    flushRaf();

    const spy = vi.spyOn(document.body, 'appendChild');
    // 新しい行が 1 行 → ミラーが 1 回だけ作られる
    rerender(<EditorArea text={"aaa\nccc"} onChange={() => {}} />);
    flushRaf();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('clears the cache when measurement environment changes', () => {
    const { rerender } = render(<EditorArea text={"aaa"} onChange={() => {}} />);
    flushRaf();

    const spy = vi.spyOn(document.body, 'appendChild');
    // 幅が変わる（環境キー不一致）→ 同じテキストでも再計測される
    width = 300;
    rerender(<EditorArea text={"aaa"} style={{ color: 'red' }} onChange={() => {}} />);
    flushRaf();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
