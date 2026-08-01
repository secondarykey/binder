import { describe, it, expect } from 'vitest';
import {
  parsePluginMeta,
  parseVersion,
  compareVersions,
  satisfiesRange,
  pluginCompatStatus,
  shouldApply,
} from '@shared/editor/pluginMeta';

describe('parsePluginMeta', () => {
  it('extracts name / version / marked from leading block comments', () => {
    const src = [
      '/* @plugin-name: Keyboard Tag ([[Key]]) */',
      '/* @plugin-version: 1.2.0 */',
      '/* @marked: >=14 <19 */',
      '(function(){ return {}; })();',
    ].join('\n');
    expect(parsePluginMeta(src)).toEqual({
      name: 'Keyboard Tag ([[Key]])',
      version: '1.2.0',
      marked: '>=14 <19',
    });
  });

  it('supports // line comments', () => {
    const src = '// @plugin-name: X\n// @marked: >=17\n(function(){})();';
    const meta = parsePluginMeta(src);
    expect(meta.name).toBe('X');
    expect(meta.marked).toBe('>=17');
    expect(meta.version).toBeNull();
  });

  it('returns nulls when no metadata present', () => {
    expect(parsePluginMeta('(function(){ return {}; })();')).toEqual({
      name: null, version: null, marked: null,
    });
  });

  it('ignores @marked appearing deep in the body', () => {
    const body = Array(60).fill('// filler').join('\n') + '\n// @marked: >=99';
    expect(parsePluginMeta(body).marked).toBeNull();
  });

  it('handles null / non-string input', () => {
    expect(parsePluginMeta(null)).toEqual({ name: null, version: null, marked: null });
    expect(parsePluginMeta(undefined)).toEqual({ name: null, version: null, marked: null });
  });
});

describe('parseVersion / compareVersions', () => {
  it('pads missing parts with zero', () => {
    expect(parseVersion('14')).toEqual([14, 0, 0]);
    expect(parseVersion('14.1')).toEqual([14, 1, 0]);
    expect(parseVersion('v18.0.7')).toEqual([18, 0, 7]);
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('9.0.0', '10.0.0')).toBe(-1);
    expect(compareVersions('14.1.4', '14.1.4')).toBe(0);
    expect(compareVersions('18.0.7', '17.9.9')).toBe(1);
  });
});

describe('satisfiesRange', () => {
  it('handles the canonical ">=14 <19" range', () => {
    expect(satisfiesRange('>=14 <19', '14.1.4')).toBe(true);
    expect(satisfiesRange('>=14 <19', '18.0.7')).toBe(true);
    expect(satisfiesRange('>=14 <19', '19.0.0')).toBe(false);
    expect(satisfiesRange('>=14 <19', '13.9.9')).toBe(false);
  });

  it('treats a bare integer as a major match', () => {
    expect(satisfiesRange('14', '14.1.4')).toBe(true);
    expect(satisfiesRange('14', '15.0.0')).toBe(false);
  });

  it('supports each operator', () => {
    // ">17" は ">17.0.0" として比較される（pad-to-zero）
    expect(satisfiesRange('>17', '18.0.0')).toBe(true);
    expect(satisfiesRange('>17', '17.9.9')).toBe(true);
    expect(satisfiesRange('>17.0.0', '17.0.0')).toBe(false);
    expect(satisfiesRange('<=17', '17.0.0')).toBe(true);
    expect(satisfiesRange('<=17', '17.0.1')).toBe(false);
    expect(satisfiesRange('=18.0.7', '18.0.7')).toBe(true);
    expect(satisfiesRange('=18', '18.0.7')).toBe(false);
  });

  it('empty range means unconstrained', () => {
    expect(satisfiesRange('', '18.0.0')).toBe(true);
    expect(satisfiesRange(null, '18.0.0')).toBe(true);
  });
});

describe('pluginCompatStatus', () => {
  const info = (major, version) => ({ major, version: version ?? String(major) });

  it('declared + satisfied => compatible', () => {
    expect(pluginCompatStatus({ marked: '>=14 <19' }, info(18, '18.0.7'))).toBe('compatible');
  });

  it('declared + not satisfied => incompatible', () => {
    expect(pluginCompatStatus({ marked: '>=17' }, info(14, '14.1.4'))).toBe('incompatible');
  });

  it('declared but marked version unknown => unknown', () => {
    expect(pluginCompatStatus({ marked: '>=17' }, { major: null, version: null })).toBe('unknown');
  });

  it('undeclared + no verified record => undeclared', () => {
    expect(pluginCompatStatus({ marked: null }, info(18))).toBe('undeclared');
  });

  it('undeclared + verified major matches => compatible', () => {
    expect(pluginCompatStatus({ marked: null }, info(18), 18)).toBe('compatible');
  });

  it('undeclared + verified major differs => unverified', () => {
    expect(pluginCompatStatus({ marked: null }, info(18), 14)).toBe('unverified');
  });
});

describe('shouldApply', () => {
  it('applies everything except incompatible', () => {
    expect(shouldApply('compatible')).toBe(true);
    expect(shouldApply('undeclared')).toBe(true);
    expect(shouldApply('unverified')).toBe(true);
    expect(shouldApply('unknown')).toBe(true);
    expect(shouldApply('incompatible')).toBe(false);
  });
});
