import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

/**
 * 本番環境では、翻訳ファイルはサーバーから取得するようにする。
 * {HOME}/.binder/locales/*.json
 * を元に形成され、*.json内には、code = その言語の名称が保存され、
 * {HTTP}/locales.json  がそのコード一覧を返してくれる。
 * 
 * 開発環境では、ローカルの翻訳ファイルを使用する。
 */
import localeEn from "./locales/en.json";
import localeJa from "./locales/ja.json";

i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
        fallbackLng: 'en',
        returnEmptyString: false,
        resources: {
            ja: { translation: localeJa },
            en: { translation: localeEn }
        },
        interpolation: {
            escapeValue: false
        },
        react: {
            transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'span']
        }
    })

export default i18n;