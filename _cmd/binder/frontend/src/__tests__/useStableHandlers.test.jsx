import { describe, it, expect, vi } from 'vitest';
import { memo, useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useStableHandlers } from '../components/editor/useStableHandlers';

describe('useStableHandlers', () => {
  it('描き直しても同じ関数を渡し、呼ぶと最新のハンドラへ届く', () => {
    const childRender = vi.fn();
    const Child = memo(function Child({ onPress }) {
      childRender();
      return <button onClick={onPress}>press</button>;
    });

    const seen = [];
    function Parent() {
      const [count, setCount] = useState(0);
      const h = useStableHandlers({
        // count を閉じ込めた関数。描画のたびに作り直される
        press: () => seen.push(count),
      });
      return (<>
        <button onClick={() => setCount((c) => c + 1)}>inc</button>
        <Child onPress={h.press} />
      </>);
    }

    render(<Parent />);
    expect(childRender).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('inc'));
    fireEvent.click(screen.getByText('inc'));
    // 親が描き直されても、memo にした子は描き直されない
    expect(childRender).toHaveBeenCalledTimes(1);

    // 呼ばれたときの state は最新のもの
    fireEvent.click(screen.getByText('press'));
    expect(seen).toEqual([2]);
  });
});
