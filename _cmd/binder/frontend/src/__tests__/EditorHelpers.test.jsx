import { describe, it, expect, beforeEach } from 'vitest';

import { flattenNotes, flattenDiagrams, flattenStructures, sortIdCandidates } from '../components/editor/tree-flatten';
import { tsvToMarkdownTable, detectTableAt } from '../components/editor/table-markdown';
import { hasConflictMarkers, buildConflictHTML } from '../components/editor/conflict-view';
import { editorHistory, editorHistoryURL } from '../components/editor/editor-history';

// Component.jsx から切り出した、状態を持たない関数のテスト

const tree = [
  { id: 'n1', name: 'Note 1', type: 'note', updated: '2026-01-01T00:00:00Z', children: [
    { id: 'd1', name: 'Diagram 1', type: 'diagram', parentId: 'n1', updated: '2026-01-03T00:00:00Z', children: [] },
    { id: 'n2', name: 'Note 2', type: 'note', parentId: 'n1', updated: '2026-01-02T00:00:00Z' },
  ] },
  { id: 'a1', name: 'Asset 1', type: 'asset', mime: 'image/png', updated: '2026-02-01T00:00:00Z' },
];

describe('tree-flatten', () => {
  it('種類ごとに再帰的に取り出す', () => {
    expect(flattenNotes(tree).map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(flattenDiagrams(tree).map((n) => n.id)).toEqual(['d1']);
    expect(flattenStructures(tree).map((n) => n.id)).toEqual(['n1', 'd1', 'n2', 'a1']);
  });

  it('flattenStructures は種類・MIME・親を持つ', () => {
    const a = flattenStructures(tree).find((s) => s.id === 'a1');
    expect(a).toMatchObject({ type: 'asset', mime: 'image/png', name: 'Asset 1' });
  });

  it('ID 一覧は子を先頭に、それぞれ更新日付の降順で、自分自身は出さない', () => {
    const sorted = sortIdCandidates(flattenStructures(tree), 'n1').map((s) => s.id);
    expect(sorted).toEqual(['d1', 'n2', 'a1']);
  });
});

describe('table-markdown', () => {
  it('タブ区切りを Markdown の表にする', () => {
    expect(tsvToMarkdownTable('a\tb\n1\t2')).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('タブ区切りでなければ null', () => {
    expect(tsvToMarkdownTable('a\tb')).toBeNull();          // 1 行だけ
    expect(tsvToMarkdownTable('a b\nc d')).toBeNull();      // タブが無い
    expect(tsvToMarkdownTable('a\tb\nc')).toBeNull();       // 列数が合わない
  });

  it('カーソルのある表の範囲を返す', () => {
    const text = 'before\n| a | b |\n| --- | --- |\n| 1 | 2 |\nafter';
    const r = detectTableAt(text, text.indexOf('| 1'));
    expect(r.lines).toEqual(['| a | b |', '| --- | --- |', '| 1 | 2 |']);
    expect(text.substring(r.startOffset, r.endOffset)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('表の外や、区切り行の無いものは null', () => {
    expect(detectTableAt('before\n| a |\n| - |', 0)).toBeNull();
    expect(detectTableAt('| a | b |\n| 1 | 2 |', 0)).toBeNull();
  });
});

describe('conflict-view', () => {
  const conflict = 'top\n<<<<<<< ours\nmine <b>\n=======\ntheirs\n>>>>>>> theirs\nbottom';

  it('3 つのマーカーがこの順に揃ったときだけ衝突とみなす', () => {
    expect(hasConflictMarkers(conflict)).toBe(true);
    expect(hasConflictMarkers('<<<<<<< ours\nonly one marker')).toBe(false);
    expect(hasConflictMarkers('')).toBe(false);
    expect(hasConflictMarkers(null)).toBe(false);
  });

  it('自分側と相手側を色分けし、本文は HTML として解釈させない', () => {
    const html = buildConflictHTML(conflict, 'banner <x>');
    expect(html).toContain('<div class="ours">mine &lt;b&gt;</div>');
    expect(html).toContain('<div class="theirs">theirs</div>');
    expect(html).toContain('<div class="">bottom</div>');
    expect(html).toContain('banner &lt;x&gt;');
  });
});

describe('editor-history', () => {
  beforeEach(() => editorHistory.clear());

  it('戻る・進むができ、同じ ID は 1 回だけ残る', () => {
    editorHistory.push('note', 'a');
    editorHistory.push('note', 'b');
    editorHistory.push('note', 'a');
    expect(editorHistory.stack.map((e) => e.id)).toEqual(['b', 'a']);

    expect(editorHistory.canGoBack()).toBe(true);
    expect(editorHistory.goBack()).toEqual({ mode: 'note', id: 'b' });
    expect(editorHistory.navigating).toBe(true);
    expect(editorHistory.canGoBack()).toBe(false);
    expect(editorHistory.goBack()).toBeNull();
    expect(editorHistory.goForward()).toEqual({ mode: 'note', id: 'a' });
    expect(editorHistory.canGoForward()).toBe(false);
  });

  it('戻った先から別のものを開くと、先の履歴は捨てる', () => {
    editorHistory.push('note', 'a');
    editorHistory.push('note', 'b');
    editorHistory.push('note', 'c');
    editorHistory.goBack();
    editorHistory.goBack();
    editorHistory.push('diagram', 'd');
    expect(editorHistory.stack.map((e) => e.id)).toEqual(['a', 'd']);
  });

  it('アセットだけ URL のモード名が違う', () => {
    expect(editorHistoryURL({ mode: 'note', id: 'x' })).toBe('/editor/note/x');
    expect(editorHistoryURL({ mode: 'asset', id: 'y' })).toBe('/editor/assets/y');
  });
});
