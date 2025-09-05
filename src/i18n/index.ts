import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import commonEn from './locales/en/common.json';
import generationFormEn from './locales/en/generation-form.json';
import editingFormEn from './locales/en/editing-form.json';
import historyPanelEn from './locales/en/history-panel.json';
import passwordDialogEn from './locales/en/password-dialog.json';
import imageOutputEn from './locales/en/image-output.json';

import commonZh from './locales/zh/common.json';
import generationFormZh from './locales/zh/generation-form.json';
import editingFormZh from './locales/zh/editing-form.json';
import historyPanelZh from './locales/zh/history-panel.json';
import passwordDialogZh from './locales/zh/password-dialog.json';
import imageOutputZh from './locales/zh/image-output.json';

const resources = {
  en: {
    common: commonEn,
    generationForm: generationFormEn,
    editingForm: editingFormEn,
    historyPanel: historyPanelEn,
    passwordDialog: passwordDialogEn,
    imageOutput: imageOutputEn,
  },
  zh: {
    common: commonZh,
    generationForm: generationFormZh,
    editingForm: editingFormZh,
    historyPanel: historyPanelZh,
    passwordDialog: passwordDialogZh,
    imageOutput: imageOutputZh,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Set default language to avoid hydration issues
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
      lookupFromPathIndex: 0,
      lookupFromSubdomainIndex: 0,
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    // Default namespace
    defaultNS: 'common',
    
    // Namespace separation
    ns: ['common', 'generationForm', 'editingForm', 'historyPanel', 'passwordDialog', 'imageOutput'],
    
    // React specific options
    react: {
      useSuspense: false, // Avoid suspense to prevent hydration issues
    },
  });

export default i18n;
