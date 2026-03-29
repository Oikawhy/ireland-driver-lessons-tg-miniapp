/**
 * Theme manager — syncs with Telegram or applies manual override.
 */
import { state, saveState } from './state.js';

export function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'auto') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
  state.settings.theme = theme;
  saveState();
}

export function initTheme() {
  applyTheme(state.settings.theme || 'auto');
}
