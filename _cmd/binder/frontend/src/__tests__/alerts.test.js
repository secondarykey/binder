import { describe, it, expect } from 'vitest';
import { ALERT_TYPES, hasAlertsPlugin, alertInsertText } from '@shared/editor/alerts';

describe('hasAlertsPlugin', () => {
  it('detects the applied GitHub Alerts plugin by file name or plugin name', () => {
    expect(hasAlertsPlugin({ 'github-alerts': { applied: true } })).toBe(true);
    expect(hasAlertsPlugin({ 'my-alerts': { applied: true, meta: { name: 'GitHub Alerts' } } })).toBe(true);
  });

  it('returns false when the plugin is missing or not applied', () => {
    expect(hasAlertsPlugin({ 'github-alerts': { applied: false } })).toBe(false);
    expect(hasAlertsPlugin({ toc: { applied: true } })).toBe(false);
    expect(hasAlertsPlugin(undefined)).toBe(false);
  });
});

describe('alertInsertText', () => {
  it('lists the five types of the plugin', () => {
    expect(ALERT_TYPES.map((a) => a.type)).toEqual(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']);
  });

  it('starts a new alert when nothing is selected', () => {
    expect(alertInsertText('', 0, 0, 'NOTE')).toBe('> [!NOTE]\n> ');
    expect(alertInsertText('a\n', 2, 2, 'TIP')).toBe('> [!TIP]\n> ');
  });

  it('breaks the line when the cursor is in the middle of a line', () => {
    expect(alertInsertText('text', 4, 4, 'WARNING')).toBe('\n> [!WARNING]\n> ');
  });

  it('wraps the selected lines', () => {
    const v = 'one\n\ntwo\n';
    expect(alertInsertText(v, 0, v.length, 'CAUTION')).toBe('> [!CAUTION]\n> one\n>\n> two\n');
    expect(alertInsertText('x one', 2, 5, 'NOTE')).toBe('\n> [!NOTE]\n> one');
  });
});
