import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('@wailsio/runtime', () => {
  const identity = (v) => v;
  const createFn = (fn) => fn || identity;
  return {
    Events: { On: vi.fn(() => () => {}), Off: vi.fn(), Emit: vi.fn() },
    Window: { SetTitle: vi.fn(), SetMaxSize: vi.fn(), SetMinSize: vi.fn(), SetSize: vi.fn() },
    Browser: { OpenURL: vi.fn() },
    Call: { ByID: vi.fn(() => Promise.resolve()) },
    CancellablePromise: Promise,
    Create: {
      Array: (fn) => (v) => (Array.isArray(v) ? v.map(createFn(fn)) : v),
      Nullable: (fn) => (v) => (v == null ? null : createFn(fn)(v)),
      Any: identity,
      Map: () => identity,
      Struct: (c) => (v) => (v instanceof c ? v : Object.assign(new c(), v)),
    },
  };
});
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
