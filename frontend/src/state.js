/**
 * Global app state — single source of truth.
 */
export const state = {
  token: null,
  userId: null,
  telegramId: null,
  firstName: null,
  settings: {
    language: 'en',
    theme: 'auto',
    haptic_feedback: true,
    exam_time_limit: 2400,
    marathon_auto_next: 0,
  },
  dashboard: null,
  currentSession: null,
  currentQuestions: [],
  currentIndex: 0,
  bookmarks: new Set(), // question_id set for quick lookup
  pausedSession: null,  // FIX #3: { sessionId, mode, currentIndex, questions }
};

/**
 * Save essential state to sessionStorage.
 */
export function saveState() {
  try {
    sessionStorage.setItem('dt_token', state.token || '');
    sessionStorage.setItem('dt_settings', JSON.stringify(state.settings));
    // FIX #3: Save paused session
    if (state.pausedSession) {
      sessionStorage.setItem('dt_paused', JSON.stringify(state.pausedSession));
    } else {
      sessionStorage.removeItem('dt_paused');
    }
  } catch (e) { /* ignore */ }
}

/**
 * Restore state from sessionStorage.
 */
export function restoreState() {
  try {
    state.token = sessionStorage.getItem('dt_token') || null;
    const s = sessionStorage.getItem('dt_settings');
    if (s) Object.assign(state.settings, JSON.parse(s));
    // FIX #3: Restore paused session
    const p = sessionStorage.getItem('dt_paused');
    if (p) state.pausedSession = JSON.parse(p);
  } catch (e) { /* ignore */ }
}
