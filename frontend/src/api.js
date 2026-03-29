/**
 * API client — fetch wrapper with JWT and language params.
 */
import { state } from './state.js';

const BASE = '/api';

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function langParam() {
  return `lang=${state.settings.language || 'en'}`;
}

// ─── Auth ────────────────────────────────────────
export function auth(initData) {
  return request('POST', '/auth', { init_data: initData });
}

// ─── Questions & Categories ──────────────────────
export function getCategories() {
  return request('GET', `/categories?${langParam()}`);
}

// ─── Question cache ──────────────────────────────
const _QCACHE_KEY = 'dt_q_cache';
const _QCACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Try to read cached full question list for current language. */
function _readCache() {
  try {
    const raw = sessionStorage.getItem(_QCACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    const lang = state.settings.language || 'en';
    if (c.lang === lang && Date.now() - c.ts < _QCACHE_TTL) return c.data;
  } catch (e) { /* ignore */ }
  return null;
}

/** Write full question list to cache. */
function _writeCache(data) {
  try {
    sessionStorage.setItem(_QCACHE_KEY, JSON.stringify({
      lang: state.settings.language || 'en',
      ts: Date.now(),
      data,
    }));
  } catch (e) { /* quota exceeded — ignore */ }
}

export async function getQuestions(mode, categoryId = null) {
  // Category mode bypasses cache (filtered server-side with offset/limit)
  if (mode === 'category' && categoryId) {
    let url = `/questions?mode=${mode}&${langParam()}&category_id=${categoryId}`;
    return request('GET', url);
  }

  // Try cache first for marathon / exam (both use the full set)
  let all = _readCache();
  if (!all) {
    // Fetch the full set (marathon mode returns all questions)
    all = await request('GET', `/questions?mode=marathon&${langParam()}`);
    _writeCache(all);
  }

  if (mode === 'exam') {
    return _shuffled(all).slice(0, 40);
  }
  // marathon or anything else — return all shuffled
  return _shuffled(all);
}

export function getBlockStats(categoryId, blockSize = 20) {
  return request('GET', `/categories/${categoryId}/block-stats?block_size=${blockSize}`);
}

// ─── Sessions ────────────────────────────────────
export function createSession(testType, categoryId = null, timeLimitSec = null) {
  const body = { test_type: testType };
  if (categoryId) body.category_id = categoryId;
  if (timeLimitSec) body.time_limit_sec = timeLimitSec;
  return request('POST', '/sessions', body);
}

export function submitAnswer(sessionId, questionId, answerId) {
  return request('POST', `/sessions/${sessionId}/answer?${langParam()}`,
    { question_id: questionId, answer_id: answerId });
}

export function finishSession(sessionId) {
  return request('POST', `/sessions/${sessionId}/finish`);
}

export function getResults(sessionId) {
  return request('GET', `/sessions/${sessionId}/results?${langParam()}`);
}

// ─── Stats ───────────────────────────────────────
export function getDashboard() {
  return request('GET', '/stats/dashboard');
}

export function getCategoryStats() {
  return request('GET', `/stats/categories?${langParam()}`);
}

// ─── SRS ─────────────────────────────────────────
export function getDueCards() {
  return request('GET', `/srs/due?${langParam()}`);
}

export function reviewCard(questionId, isCorrect) {
  return request('POST', '/srs/review',
    { question_id: questionId, is_correct: isCorrect });
}

// ─── Settings ────────────────────────────────────
export function getSettings() {
  return request('GET', '/settings');
}

export function updateSettings(settings) {
  return request('PUT', '/settings', settings);
}

// ─── Bookmarks ───────────────────────────────────
export function getBookmarks() {
  return request('GET', `/bookmarks?${langParam()}`);
}

export function addBookmark(questionId) {
  return request('POST', '/bookmarks', { question_id: questionId });
}

export function removeBookmark(questionId) {
  return request('DELETE', `/bookmarks/${questionId}`);
}

// ─── Health ──────────────────────────────────────
export function healthCheck() {
  return request('GET', '/health');
}

// ─── Discard ─────────────────────────────────────
export function discardSession(sessionId) {
  return request('POST', `/sessions/${sessionId}/discard`);
}

// ─── Clear Data ──────────────────────────────────
export function clearSRS() {
  return request('DELETE', '/settings/clear-srs');
}

export function clearAllData() {
  return request('DELETE', '/settings/clear-all');
}
