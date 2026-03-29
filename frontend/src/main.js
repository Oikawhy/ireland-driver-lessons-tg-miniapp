/**
 * Ireland Driver Test — Main Entry Point
 *
 * Initializes Telegram WebApp SDK, authenticates, loads settings,
 * registers all routes, and starts the SPA router.
 */
import './styles/index.css';
import { state, restoreState, saveState } from './state.js';
import { initRouter, route, navigate } from './router.js';
import { initTheme, applyTheme } from './theme.js';
import { setLang } from './i18n/index.js';
import * as api from './api.js';

// Import pages
import { menuPage } from './pages/menu.js';
import { examPage } from './pages/exam.js';
import { marathonPage } from './pages/marathon.js';
import { incorrectPage } from './pages/incorrect.js';
import { categoryPage } from './pages/category.js';
import { resultsPage } from './pages/results.js';
import { settingsPage } from './pages/settings.js';
import { bookmarksPage } from './pages/bookmarks.js';

// ─── Telegram WebApp ─────────────────────────────
const tg = window.Telegram?.WebApp;

function haptic(type = 'impact') {
  if (state.settings.haptic_feedback && tg?.HapticFeedback) {
    if (type === 'impact') tg.HapticFeedback.impactOccurred('light');
    else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
    else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    else if (type === 'warning') tg.HapticFeedback.notificationOccurred('warning');
  }
}

// Export haptic for use in pages
window._haptic = haptic;

// ─── Init ────────────────────────────────────────
async function init() {
  // 1. Restore saved state
  restoreState();

  // 2. Tell Telegram we're ready
  if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
  }

  // 3. Authenticate
  if (!state.token) {
    try {
      const initData = tg?.initData || '';
      if (initData) {
        const authResult = await api.auth(initData);
        state.token = authResult.token;
        state.userId = authResult.user_id;
        state.telegramId = authResult.telegram_id;
        state.firstName = authResult.first_name;
        saveState();
      } else {
        // Dev mode: use health check to verify backend
        console.log('⚠️ No Telegram initData — development mode');
        // Create a dev token placeholder
        state.firstName = 'Developer';
      }
    } catch (err) {
      console.error('Auth failed:', err);
    }
  }

  // 4. Load settings
  if (state.token) {
    try {
      const settings = await api.getSettings();
      Object.assign(state.settings, settings);
      saveState();
    } catch (err) {
      console.log('Using default settings');
    }
  }

  // 5. Apply theme and language
  setLang(state.settings.language);
  initTheme();

  // 6. Register routes
  route('menu', menuPage);
  route('exam', examPage);
  route('marathon', marathonPage);
  route('incorrect', incorrectPage);
  route('category', categoryPage);
  route('results', resultsPage);
  route('settings', settingsPage);
  route('bookmarks', bookmarksPage);

  // 7. Start router
  initRouter();
}

// ─── Start ───────────────────────────────────────
init().catch((err) => {
  console.error('Init failed:', err);
  document.getElementById('app').innerHTML = `
    <div class="empty-state">
      <div class="emoji">⚠️</div>
      <p>${err.message}</p>
    </div>
  `;
});
