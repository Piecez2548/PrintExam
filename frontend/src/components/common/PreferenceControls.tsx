import React from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import i18n, { AppLanguage } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

interface PreferenceControlsProps {
  compact?: boolean;
}

export const PreferenceControls: React.FC<PreferenceControlsProps> = ({ compact = false }) => {
  const { t } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'th';

  const switchLanguage = () => {
    const nextLanguage: AppLanguage = language === 'th' ? 'en' : 'th';
    void i18n.changeLanguage(nextLanguage);
  };

  const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900';

  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={t('Language and appearance preferences')}>
      <button type="button" onClick={switchLanguage} className={buttonClass} aria-label={t('Switch language')} title={t('Switch language')}>
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span>{language === 'th' ? 'TH' : 'EN'}</span>
        {!compact && <span className="sr-only">{language === 'th' ? t('Thai') : t('English')}</span>}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className={buttonClass}
        aria-label={theme === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}
        title={theme === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
        <span>{theme === 'light' ? t('Light') : t('Dark')}</span>
      </button>
    </div>
  );
};
