import '@testing-library/jest-dom/vitest';

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: { cancel: 'Cancel', delete: 'Delete', close: 'Close', private: 'Private' },
        editor: { searchPlaceholder: 'Search...', searchNoMatches: 'No matches' },
      },
    },
  },
  interpolation: { escapeValue: false },
});
