import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import i18n from './i18n';
import { ThemeProvider } from './context/ThemeContext';

const validityMessage = (control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  if (control.validity.valueMissing) return i18n.t('This field is required.', { ns: 'common' });
  if (control.validity.typeMismatch && control instanceof HTMLInputElement && control.type === 'email') {
    return i18n.t('Enter a valid email address.', { ns: 'common' });
  }
  if (control.validity.tooShort && control instanceof HTMLInputElement) {
    return i18n.t('Enter at least {{count}} characters.', { ns: 'common', count: control.minLength });
  }
  if (control.validity.patternMismatch) return i18n.t('Use the expected format for this field.', { ns: 'common' });
  return i18n.t('Check this field and try again.', { ns: 'common' });
};

document.addEventListener('invalid', (event) => {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    control.setCustomValidity(validityMessage(control));
  }
}, true);

document.addEventListener('input', (event) => {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    control.setCustomValidity('');
  }
}, true);

document.addEventListener('change', (event) => {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    control.setCustomValidity('');
  }
}, true);

i18n.on('languageChanged', () => {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
    .forEach((control) => control.setCustomValidity(''));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
