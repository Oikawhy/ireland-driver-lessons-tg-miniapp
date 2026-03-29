/**
 * i18n system — UI string manager.
 * Supports nested keys and parameter interpolation.
 */
import en from './en.js';
import ru from './ru.js';

const langs = { en, ru };
let current = 'en';

/**
 * Set the active language.
 */
export function setLang(lang) {
  current = langs[lang] ? lang : 'en';
}

/**
 * Get the current language code.
 */
export function getLang() {
  return current;
}

/**
 * Translate a key with optional parameter interpolation.
 * @param {string} key - Dot-separated key (e.g., 'menu.exam')
 * @param {Object} params - Substitution params (e.g., { n: 5 })
 * @returns {string} Translated string or key if missing
 *
 * Usage: t('exam.question', { n: 5, total: 40 }) → "Question 5/40"
 */
export function t(key, params = {}) {
  let str = key.split('.').reduce((obj, k) => obj?.[k], langs[current]);
  if (str === undefined) return key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}
