/**
 * Menu page — main menu with progress dashboard.
 */
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';

export async function menuPage(app) {
  app.innerHTML = '<div class="spinner"></div>';

  // Load dashboard stats
  let stats = { exams_taken: 0, exams_passed: 0, pass_rate: null, mastered_count: 0, due_today: 0, overall_accuracy: null, total_questions: 805 };
  if (state.token) {
    try { stats = await api.getDashboard(); } catch (e) { console.log('Stats unavailable'); }
  }
  state.dashboard = stats;

  const name = state.firstName || 'Driver';

  app.innerHTML = `
    <div class="menu-page fade-in">
      <div class="menu-header">
        <h1>${t('menu.title')}</h1>
        <p class="greeting">${t('menu.greeting', { name })}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.exams_taken}</div>
          <div class="stat-label">${t('stats.examsTaken')}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">${stats.pass_rate !== null ? stats.pass_rate + '%' : '—'}</div>
          <div class="stat-label">${t('stats.passRate')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.mastered_count}</div>
          <div class="stat-label">${t('stats.mastered')}</div>
        </div>
        <div class="stat-card ${stats.due_today > 0 ? 'warn' : ''}">
          <div class="stat-value">${stats.due_today}</div>
          <div class="stat-label">${t('stats.dueToday')}</div>
        </div>
      </div>

      <div class="menu-modes">
        <button class="mode-btn" data-testid="btn-exam" id="btn-exam">
          <div class="mode-icon">📝</div>
          <div class="mode-info">
            <div class="mode-title">${t('menu.exam')}</div>
            <div class="mode-desc">${t('menu.examDesc')}</div>
          </div>
          <span class="mode-badge badge-green">40</span>
        </button>

        <button class="mode-btn" data-testid="btn-marathon" id="btn-marathon">
          <div class="mode-icon">🏃</div>
          <div class="mode-info">
            <div class="mode-title">${t('menu.marathon')}</div>
            <div class="mode-desc">${t('menu.marathonDesc')}</div>
          </div>
          <span class="mode-badge badge-gray">${stats.total_questions}</span>
        </button>

        <button class="mode-btn" data-testid="btn-incorrect" id="btn-incorrect">
          <div class="mode-icon">🔄</div>
          <div class="mode-info">
            <div class="mode-title">${t('menu.incorrect')}</div>
            <div class="mode-desc">${t('menu.incorrectDesc')}</div>
          </div>
          <span class="mode-badge ${stats.due_today > 0 ? 'badge-red' : 'badge-gray'}">${stats.due_today > 0 ? t('menu.due', { n: stats.due_today }) : t('menu.noDue')}</span>
        </button>

        <button class="mode-btn" data-testid="btn-category" id="btn-category">
          <div class="mode-icon">📚</div>
          <div class="mode-info">
            <div class="mode-title">${t('menu.category')}</div>
            <div class="mode-desc">${t('menu.categoryDesc')}</div>
          </div>
        </button>
      </div>

      <div class="menu-bottom">
        <button class="btn btn-secondary" data-testid="btn-bookmarks" id="btn-bookmarks">${t('menu.bookmarks')}</button>
        <button class="btn btn-secondary" data-testid="btn-settings" id="btn-settings">${t('menu.settings')}</button>
      </div>
    </div>
  `;

  // Event listeners
  app.querySelector('#btn-exam').onclick = () => { window._haptic?.('impact'); navigate('exam'); };
  app.querySelector('#btn-marathon').onclick = () => { window._haptic?.('impact'); navigate('marathon'); };
  app.querySelector('#btn-incorrect').onclick = () => { window._haptic?.('impact'); navigate('incorrect'); };
  app.querySelector('#btn-category').onclick = () => { window._haptic?.('impact'); navigate('category'); };
  app.querySelector('#btn-bookmarks').onclick = () => { window._haptic?.('impact'); navigate('bookmarks'); };
  app.querySelector('#btn-settings').onclick = () => { window._haptic?.('impact'); navigate('settings'); };
}
