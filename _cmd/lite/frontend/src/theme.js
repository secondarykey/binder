import { GetThemeCSS, SetTheme } from '../bindings/binder/lite/app';

let styleEl = null;
let mediaQuery = null;
let mediaListener = null;

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

/**
 * システムのカラースキームに基づいてテーマを適用する。
 */
function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(isDark ? 'dark' : 'light');
}

/**
 * テーマモードを設定する。
 * @param {'system' | 'light' | 'dark'} mode
 */
export async function setThemeMode(mode) {
  // 既存のシステムモードリスナーをクリア
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
    mediaQuery = null;
    mediaListener = null;
  }

  if (mode === 'system') {
    // システムの設定に従う + 変更を監視
    applySystemTheme();
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = () => applySystemTheme();
    mediaQuery.addEventListener('change', mediaListener);
  } else {
    await applyTheme(mode);
  }

  // 設定を保存（"system" もそのまま保存）
  try {
    await SetTheme(mode);
  } catch (err) {
    console.error('Failed to save theme mode:', err);
  }
}

/**
 * 保存されたテーマ設定で初期化する。
 * @param {string} saved - 保存されたテーマ値（"system", "dark", "light"）
 */
export function initTheme(saved) {
  const mode = saved || 'system';
  setThemeMode(mode);
  return mode;
}
