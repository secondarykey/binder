import { describe, it, expect } from 'vitest';
import { publishWarningMessage } from '../publish-warning';

// t の代わりに、キーと件数を返す
const t = (key, opts) => `${key}:${opts.count}`;

describe('publishWarningMessage', () => {
  it('uses the general message when there are no script warnings', () => {
    const warnings = ['link(a): not published yet', 'assets(b): private entry'];
    expect(publishWarningMessage(t, warnings)).toBe('preview.publishWarn:2');
  });

  // スクリプトの警告は件数だけでは中身が分からないため、専用の文で知らせる
  it('prefers the scripts message and counts only script warnings', () => {
    const warnings = [
      'link(a): not published yet',
      'scripts(n1): the page has scripts that are blocked in the preview',
      'scripts(n2): the page has scripts that are blocked in the preview',
    ];
    expect(publishWarningMessage(t, warnings)).toBe('preview.publishScriptsWarn:2');
  });
});
