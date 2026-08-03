import { describe, it, expect, beforeEach } from 'vitest';
import { attachPanZoom } from '@shared/editor/pan-zoom';

// jsdom の document をプレビュー iframe の contentDocument に見立てて検証する
function setBody(html) {
  document.body.innerHTML = html;
  return document.body.firstElementChild;
}

// jsdom は PointerEvent を持たないため MouseEvent で代用する（型名で配送される）
function pointer(type, props = {}) {
  return new MouseEvent(type, { bubbles: true, ...props });
}

describe('attachPanZoom', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing without an svg', () => {
    const el = setBody('<div class="binderMermaid">text</div>');
    expect(attachPanZoom(el)).toBe(false);
  });

  it('does not attach twice', () => {
    const el = setBody('<div><svg></svg></div>');
    expect(attachPanZoom(el)).toBe(true);
    expect(attachPanZoom(el)).toBe(false);
  });

  it('zooms with the wheel', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el);

    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100 }));

    expect(el.querySelector('svg').style.transform).toMatch(/scale\(1\.1\)/);
  });

  it('requires ctrl for the wheel when wheelModifier is set', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el, { wheelModifier: true });
    const svg = el.querySelector('svg');

    // 修飾キー無しはページスクロールに任せる（図は変わらない）
    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100 }));
    expect(svg.style.transform).toBe('');

    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100, ctrlKey: true }));
    expect(svg.style.transform).toMatch(/scale\(1\.1\)/);
  });

  it('pans with a drag', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el);

    el.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 25 }));
    el.dispatchEvent(pointer('pointerup', { button: 0 }));

    expect(el.querySelector('svg').style.transform).toContain('translate(30px, 15px)');
  });

  it('ignores drags that start on a button (copy button)', () => {
    const el = setBody('<div><svg></svg><button class="binderCopyButton">Copy</button></div>');
    attachPanZoom(el);
    const btn = el.querySelector('button');

    btn.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 25 }));

    expect(el.querySelector('svg').style.transform).toBe('');
  });

  it('resets on double click', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el);
    const svg = el.querySelector('svg');

    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100 }));
    el.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 0, clientY: 0 }));
    el.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 20 }));
    el.dispatchEvent(pointer('pointerup', { button: 0 }));
    expect(svg.style.transform).not.toBe('translate(0px, 0px) scale(1)');

    el.dispatchEvent(pointer('dblclick'));
    expect(svg.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('adds control buttons when controls is set', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el, {
      controls: true,
      labels: { zoomIn: '拡大', zoomOut: '縮小', reset: '元に戻す', pan: '移動' },
    });

    const buttons = el.querySelectorAll('.binderPanZoomBtn');
    // 拡大・縮小・リセット + 上下左右
    expect(buttons).toHaveLength(7);
    expect(el.querySelector('[aria-label="拡大"]')).not.toBeNull();
  });

  it('zooms and pans from the buttons', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el, { controls: true });
    const svg = el.querySelector('svg');
    const byLabel = (label) => el.querySelector(`[aria-label="${label}"]`);

    byLabel('Zoom in').click();
    expect(svg.style.transform).toMatch(/scale\(1\.25\)/);

    byLabel('Zoom out').click();
    expect(svg.style.transform).toMatch(/scale\(1\)/);

    // 上ボタン: 図を下へ動かして上の内容を見せる
    byLabel('Pan').click();
    expect(svg.style.transform).toContain('translate(0px, 40px)');

    byLabel('Reset').click();
    expect(svg.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('does not start a drag from a control button', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el, { controls: true });
    const svg = el.querySelector('svg');

    el.querySelector('.binderPanZoomBtn').dispatchEvent(
      pointer('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    );
    el.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 60 }));

    expect(svg.style.transform).not.toContain('translate(50px, 50px)');
  });

  it('puts the hint in the title attribute', () => {
    const el = setBody('<div><svg></svg></div>');
    attachPanZoom(el, { hint: 'ホイールで拡大縮小' });
    expect(el.getAttribute('title')).toBe('ホイールで拡大縮小');
  });
});
