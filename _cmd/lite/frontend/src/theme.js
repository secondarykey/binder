import { GetThemeCSS } from '../bindings/binder/lite/app';

let styleEl = null;

/**
 * 指定テーマIDのCSSを読み込み、<style> タグとして DOM に注入する。
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
    document.documentElement.dataset.theme = themeId;
  } catch (err) {
    console.error('Failed to load theme:', themeId, err);
    if (themeId !== 'dark') {
      await applyTheme('dark');
    }
  }
}
