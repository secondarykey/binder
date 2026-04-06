import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { GetLanguageData } from '../bindings/binder/api/app'

i18n
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        returnEmptyString: false,
        resources: {},
        interpolation: {
            escapeValue: false
        },
        react: {
            transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'span']
        }
    })

/**
 * 指定言語コードの翻訳データを動的に読み込み、i18next に登録する。
 * ~/.binder/languages/ から Go API 経由で JSON を取得する。
 */
export async function loadLanguage(code) {
    try {
        const jsonStr = await GetLanguageData(code);
        const data = JSON.parse(jsonStr);
        i18n.addResourceBundle(code, 'translation', data, true, true);
        await i18n.changeLanguage(code);
    } catch (err) {
        console.error('Failed to load language:', code, err);
        // en にフォールバック（ただし無限ループ防止）
        if (code !== 'en') {
            await loadLanguage('en');
        }
    }
}

export default i18n;
