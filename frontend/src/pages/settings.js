/**
 * Settings page — all user preferences.
 * Settings auto-save on every change (debounced for sliders).
 */
import { t } from '../i18n/index.js';
import { state, saveState } from '../state.js';
import { navigate } from '../router.js';
import { applyTheme } from '../theme.js';
import { setLang } from '../i18n/index.js';
import * as api from '../api.js';

let _saveTimer = null;

/** Persist settings to local storage + API (debounced). */
function persistSettings(delay = 400) {
  saveState();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      if (state.token) await api.updateSettings(state.settings);
    } catch (e) { console.error('Settings sync failed', e); }
  }, delay);
}

export async function settingsPage(app) {
  const s = state.settings;

  app.innerHTML = `
    <div class="settings-page fade-in">
      <div class="page-header">
        <button class="btn-back" id="btn-back">&lt;</button>
        <h2>${t('settings.title')}</h2>
      </div>

      <!-- Language -->
      <div class="settings-group">
        <div class="settings-group-label">${t('settings.language')}</div>
        <div class="setting-row">
          <div class="segmented" id="seg-lang">
            <button data-val="en" class="${s.language === 'en' ? 'active' : ''}">English</button>
            <button data-val="ru" class="${s.language === 'ru' ? 'active' : ''}">Русский</button>
          </div>
        </div>
      </div>

      <!-- Theme -->
      <div class="settings-group">
        <div class="settings-group-label">${t('settings.theme')}</div>
        <div class="setting-row">
          <div class="segmented" id="seg-theme">
            <button data-val="auto" class="${s.theme === 'auto' ? 'active' : ''}">${t('settings.themeAuto')}</button>
            <button data-val="dark" class="${s.theme === 'dark' ? 'active' : ''}">${t('settings.themeDark')}</button>
            <button data-val="light" class="${s.theme === 'light' ? 'active' : ''}">${t('settings.themeLight')}</button>
          </div>
        </div>
      </div>

      <!-- Haptic -->
      <div class="settings-group">
        <div class="setting-row">
          <span class="setting-label">${t('settings.haptic')}</span>
          <label class="toggle">
            <input type="checkbox" id="toggle-haptic" ${s.haptic_feedback ? 'checked' : ''} />
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <!-- Exam Time -->
      <div class="settings-group">
        <div class="setting-row full-width">
          <div class="slider-header">
            <span class="setting-label">${t('settings.examTime')}</span>
            <span class="slider-value" id="exam-time-val">${Math.round(s.exam_time_limit / 60)} ${t('settings.examTimeValue', { n: '' }).trim()}</span>
          </div>
          <input type="range" id="slider-exam-time" min="1800" max="2700" step="60" value="${s.exam_time_limit}" />
        </div>
      </div>

      <!-- Auto-Next -->
      <div class="settings-group">
        <div class="setting-row full-width">
          <div class="slider-header">
            <span class="setting-label">${t('settings.autoNext')}</span>
            <span class="slider-value" id="auto-next-val">${s.marathon_auto_next === 0 ? t('settings.autoNextOff') : t('settings.autoNextValue', { n: s.marathon_auto_next })}</span>
          </div>
          <input type="range" id="slider-auto-next" min="0" max="30" step="1" value="${s.marathon_auto_next}" />
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-group" style="margin-top:var(--space-lg);">
        <div class="settings-group-label" style="color:var(--wrong);">${t('settings.dangerZone')}</div>
        <button class="btn btn-danger" id="btn-clear-srs">${t('settings.clearSRS')}</button>
        <button class="btn btn-danger" id="btn-clear-all" style="margin-top:var(--space-sm);">${t('settings.clearAll')}</button>
      </div>
    </div>
  `;

  // ─── Event handlers ────
  app.querySelector('#btn-back').onclick = () => navigate('menu');

  // Segmented: Language
  setupSegmented(app, '#seg-lang', (val) => {
    state.settings.language = val;
    setLang(val);
    persistSettings(0); // save immediately
    // Re-render to show new language immediately
    settingsPage(app);
  });

  // Segmented: Theme
  setupSegmented(app, '#seg-theme', (val) => {
    state.settings.theme = val;
    applyTheme(val);
    persistSettings(0);
  });

  // Haptic toggle
  app.querySelector('#toggle-haptic').onchange = (e) => {
    state.settings.haptic_feedback = e.target.checked;
    if (e.target.checked) window._haptic?.('impact');
    persistSettings(0);
  };

  // Exam time slider
  const examSlider = app.querySelector('#slider-exam-time');
  examSlider.oninput = (e) => {
    const val = parseInt(e.target.value);
    state.settings.exam_time_limit = val;
    app.querySelector('#exam-time-val').textContent = t('settings.examTimeValue', { n: Math.round(val / 60) });
    persistSettings(); // debounced
  };

  // Auto-next slider
  const autoSlider = app.querySelector('#slider-auto-next');
  autoSlider.oninput = (e) => {
    const val = parseInt(e.target.value);
    state.settings.marathon_auto_next = val;
    app.querySelector('#auto-next-val').textContent =
      val === 0 ? t('settings.autoNextOff') : t('settings.autoNextValue', { n: val });
    persistSettings(); // debounced
  };

  // Clear SRS
  app.querySelector('#btn-clear-srs').onclick = async () => {
    if (!confirm(t('settings.confirmClearSRS'))) return;
    try {
      await api.clearSRS();
      window._haptic?.('success');
      alert(t('settings.clearedSRS'));
    } catch (err) { console.error(err); }
  };

  // Clear all data
  app.querySelector('#btn-clear-all').onclick = async () => {
    if (!confirm(t('settings.confirmClearAll'))) return;
    try {
      await api.clearAllData();
      state.bookmarks.clear();
      state.dashboard = null;
      saveState();
      window._haptic?.('success');
      alert(t('settings.clearedAll'));
    } catch (err) { console.error(err); }
  };
}

function setupSegmented(app, selector, onChange) {
  const seg = app.querySelector(selector);
  if (!seg) return;
  seg.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window._haptic?.('impact');
      onChange(btn.dataset.val);
    };
  });
}
