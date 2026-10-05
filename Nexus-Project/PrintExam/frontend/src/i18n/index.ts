import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonTh from '../locales/th/common.json';
import commonEn from '../locales/en/common.json';
import coverSheetTh from '../locales/th/coverSheet.json';
import coverSheetEn from '../locales/en/coverSheet.json';
import adminTh from '../locales/th/admin.json';
import adminEn from '../locales/en/admin.json';
import authTh from '../locales/th/auth.json';
import authEn from '../locales/en/auth.json';
import avStaffTh from '../locales/th/avStaff.json';
import avStaffEn from '../locales/en/avStaff.json';
import coordinatorTh from '../locales/th/coordinator.json';
import coordinatorEn from '../locales/en/coordinator.json';
import instructorTh from '../locales/th/instructor.json';
import instructorEn from '../locales/en/instructor.json';
import notificationsTh from '../locales/th/notifications.json';
import notificationsEn from '../locales/en/notifications.json';
import profileTh from '../locales/th/profile.json';
import profileEn from '../locales/en/profile.json';
import statusesTh from '../locales/th/statuses.json';
import statusesEn from '../locales/en/statuses.json';

export type AppLanguage = 'th' | 'en';

export const LANGUAGE_STORAGE_KEY = 'printexam.language';

const languageResources = {
  th: {
    common: commonTh,
    coverSheet: coverSheetTh,
    admin: adminTh,
    auth: authTh,
    avStaff: avStaffTh,
    coordinator: coordinatorTh,
    instructor: instructorTh,
    notifications: notificationsTh,
    profile: profileTh,
    statuses: statusesTh,
  },
  en: {
    common: commonEn,
    coverSheet: coverSheetEn,
    admin: adminEn,
    auth: authEn,
    avStaff: avStaffEn,
    coordinator: coordinatorEn,
    instructor: instructorEn,
    notifications: notificationsEn,
    profile: profileEn,
    statuses: statusesEn,
  },
};

function getInitialLanguage(): AppLanguage {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
}

void i18n.use(initReactI18next).init({
  resources: languageResources,
  lng: getInitialLanguage(),
  fallbackLng: 'th',
  fallbackNS: 'common',
  supportedLngs: ['th', 'en'],
  defaultNS: 'common',
  ns: Object.keys(languageResources.th),
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

function syncDocumentLanguage(language: string | undefined) {
  const normalized: AppLanguage = language === 'en' ? 'en' : 'th';
  document.documentElement.lang = normalized;
  document.title = normalized === 'th'
    ? 'ระบบจัดการพิมพ์ข้อสอบ (Online Exam Printing Management System)'
    : 'Online Exam Printing Management System';
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // The selected language remains active for this page even if storage is unavailable.
  }
}

i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.resolvedLanguage);

export default i18n;
