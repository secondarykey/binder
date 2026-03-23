import { GetThemeCSS } from '../bindings/binder/api/app';

let styleEl = null;

/**
 * 指定テーマIDのCSSを読み込み、<style> タグとして DOM に注入する。
 * 既存のテーマスタイルがあれば上書きする。
 */
export async function applyTheme(themeId) {
  try {
    const css = await GetThemeCSS(themeId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'binder-theme';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
    // data-theme 属性も設定（テーマID参照用）
    document.documentElement.dataset.theme = themeId;
  } catch (err) {
    console.error('Failed to load theme:', themeId, err);
    // dark にフォールバック（ただし無限ループ防止）
    if (themeId !== 'dark') {
      await applyTheme('dark');
    }
  }
}
