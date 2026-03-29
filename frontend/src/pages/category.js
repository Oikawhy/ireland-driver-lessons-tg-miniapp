/**
 * Category page — two-level navigation:
 *   1. Category list (5-6 categories)
 *   2. Subcategory blocks of 20 questions within a category (with accuracy)
 *   3. Quiz within a block
 */
import { t } from '../i18n/index.js';
import { state, saveState } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';
import { renderQuestionCard, showFeedback } from '../components/questionCard.js';

const BLOCK_SIZE = 20;

export async function categoryPage(app, params) {
  // Level 3: Quiz — category_id + block provided
  if (params?.id && params?.block !== undefined) {
    const blockStart = parseInt(params.block || '0');
    return categoryQuiz(app, parseInt(params.id), params.name || '', blockStart);
  }

  // Level 2: Blocks — category_id provided, no block
  if (params?.id) {
    return categoryBlocks(app, parseInt(params.id), params.name || '');
  }

  // Level 1: Category list
  app.innerHTML = '<div class="spinner"></div>';

  let categories = [];
  try {
    categories = await api.getCategories();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  app.innerHTML = `
    <div class="settings-page fade-in">
      <div class="page-header">
        <button class="btn-back" id="btn-back">&lt;</button>
        <h2>${t('category.title')}</h2>
      </div>
      <div class="menu-modes" id="cat-list"></div>
    </div>
  `;

  app.querySelector('#btn-back').onclick = () => navigate('menu');

  const list = app.querySelector('#cat-list');
  categories.forEach(cat => {
    const totalQ = cat.question_count || 0;
    const acc = cat.accuracy;
    let indicator = '⚪';
    let badgeClass = 'badge-gray';
    if (acc !== null && acc !== undefined) {
      if (acc >= 85) { badgeClass = 'badge-green'; indicator = '🟢'; }
      else if (acc >= 70) { badgeClass = 'badge-yellow'; indicator = '🟡'; }
      else { badgeClass = 'badge-red'; indicator = '🔴'; }
    }

    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.innerHTML = `
      <div class="mode-icon">${indicator}</div>
      <div class="mode-info">
        <div class="mode-title">${cat.name}</div>
        <div class="mode-desc">${t('category.questions', { n: totalQ })}</div>
      </div>
      <span class="mode-badge ${badgeClass}">${acc !== null && acc !== undefined ? acc + '%' : '—'}</span>
    `;
    btn.onclick = () => {
      window._haptic?.('impact');
      navigate(`category?id=${cat.id}&name=${encodeURIComponent(cat.name)}`);
    };
    list.appendChild(btn);
  });
}

/**
 * Level 2: Show blocks of 20 questions for a category, with per-block accuracy.
 */
async function categoryBlocks(app, categoryId, categoryName) {
  app.innerHTML = '<div class="spinner"></div>';

  let totalQ = 0;
  let categoryAccuracy = null;
  let blockStats = [];
  try {
    const categories = await api.getCategories();
    const cat = categories.find(c => c.id === categoryId);
    totalQ = cat ? cat.question_count : 0;
    categoryAccuracy = cat ? cat.accuracy : null;

    // Fetch per-block accuracy
    try {
      blockStats = await api.getBlockStats(categoryId, BLOCK_SIZE);
    } catch (e) {
      // Fallback: no per-block stats
      blockStats = [];
    }
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  const blocks = Math.ceil(totalQ / BLOCK_SIZE);

  app.innerHTML = `
    <div class="settings-page fade-in">
      <div class="page-header">
        <button class="btn-back" id="btn-back">&lt;</button>
        <h2>${categoryName}</h2>
      </div>
      <div class="menu-modes" id="block-list"></div>
    </div>
  `;

  app.querySelector('#btn-back').onclick = () => navigate('category');

  const list = app.querySelector('#block-list');
  for (let b = 0; b < blocks; b++) {
    const start = b * BLOCK_SIZE + 1;
    const end = Math.min((b + 1) * BLOCK_SIZE, totalQ);

    // Find accuracy for this block
    const bs = blockStats.find(s => s.block_start === b * BLOCK_SIZE);
    const acc = bs ? bs.accuracy : null;

    let indicator = '⚪';
    let badgeClass = 'badge-gray';
    if (acc !== null && acc !== undefined) {
      if (acc >= 85) { badgeClass = 'badge-green'; indicator = '🟢'; }
      else if (acc >= 70) { badgeClass = 'badge-yellow'; indicator = '🟡'; }
      else { badgeClass = 'badge-red'; indicator = '🔴'; }
    }

    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.innerHTML = `
      <div class="mode-icon">${indicator}</div>
      <div class="mode-info">
        <div class="mode-title">${t('category.questions', { n: '' }).trim()} ${start}–${end}</div>
        <div class="mode-desc">${end - start + 1} ${t('category.questions', { n: end - start + 1 }).replace(/^\d+\s*/, '')}</div>
      </div>
      <span class="mode-badge ${badgeClass}">${acc !== null && acc !== undefined ? acc + '%' : '—'}</span>
    `;
    btn.onclick = () => {
      window._haptic?.('impact');
      navigate(`category?id=${categoryId}&name=${encodeURIComponent(categoryName)}&block=${b * BLOCK_SIZE}`);
    };
    list.appendChild(btn);
  }
}

async function categoryQuiz(app, categoryId, categoryName, blockStart) {
  app.innerHTML = '<div class="spinner"></div>';

  // Check for paused session
  const paused = state.pausedSession;
  if (paused && paused.mode === 'category' && paused.categoryId === categoryId) {
    try {
      const questions = paused.questions;
      const session = { id: paused.sessionId };
      let currentIndex = paused.currentIndex;
      state.pausedSession = null;
      saveState();
      renderCategoryQuestion(app, questions, session, currentIndex, categoryName, categoryId, paused.blockStart || blockStart);
      return;
    } catch (e) {
      state.pausedSession = null;
      saveState();
    }
  }

  let allQuestions = [];
  let session = null;
  try {
    allQuestions = await api.getQuestions('category', categoryId);
    session = await api.createSession('category', categoryId);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  // Slice to the block
  const questions = allQuestions.slice(blockStart, blockStart + BLOCK_SIZE);
  if (questions.length === 0) {
    app.innerHTML = '<div class="empty-state"><div class="emoji">📭</div><p>No questions in this block</p></div>';
    return;
  }

  renderCategoryQuestion(app, questions, session, 0, categoryName, categoryId, blockStart);
}

function renderCategoryQuestion(app, questions, session, currentIndex, categoryName, categoryId, blockStart, userAnswers) {
  if (!userAnswers) userAnswers = {};
  const q = questions[currentIndex];
  const previousAnswer = userAnswers[q.id];

  app.innerHTML = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        ${currentIndex > 0 ? '<button class="btn-close" id="btn-prev" title="Previous">&lt;</button>' : '<div></div>'}
        <div class="quiz-progress">${t('exam.question', { n: currentIndex + 1, total: questions.length })}</div>
        <div class="quiz-topbar-actions">
          <button class="btn-close" id="btn-pause" title="Pause">⏸</button>
          <button class="btn-close" id="btn-quit" title="Close">✕</button>
        </div>
      </div>
      <div class="quiz-progress-bar"><div class="fill" style="width:${((currentIndex + 1) / questions.length) * 100}%"></div></div>
      <div class="question-category">${categoryName}</div>
      <div id="question-container"></div>
      <div class="quiz-bottom" id="quiz-bottom" style="display:none;">
        <button class="btn btn-primary" id="btn-next">${t('common.next')}</button>
      </div>
    </div>
  `;

  const resultsUrl = `results?session=${session.id}&mode=category&blockStart=${blockStart}&blockSize=${questions.length}`;

  // Close button
  app.querySelector('#btn-quit').onclick = async () => {
    try { await api.finishSession(session.id); } catch (e) {}
    navigate(resultsUrl);
  };

  // Back button
  const prevBtn = app.querySelector('#btn-prev');
  if (prevBtn) {
    prevBtn.onclick = () => {
      currentIndex--;
      renderCategoryQuestion(app, questions, session, currentIndex, categoryName, categoryId, blockStart, userAnswers);
    };
  }

  // Pause button
  app.querySelector('#btn-pause').onclick = () => {
    state.pausedSession = {
      sessionId: session.id,
      mode: 'category',
      categoryId,
      currentIndex,
      questions,
      blockStart,
      userAnswers,
    };
    saveState();
    window._haptic?.('impact');
    navigate('menu');
  };

  renderQuestionCard(
    app.querySelector('#question-container'),
    q,
    true,
    async (answerId) => {
      userAnswers[q.id] = answerId;
      try {
        const result = await api.submitAnswer(session.id, q.id, answerId);
        showFeedback(app, q, answerId, result);
        window._haptic?.(result.is_correct ? 'success' : 'error');
        app.querySelector('#quiz-bottom').style.display = 'flex';
      } catch (e) { console.error(e); }
    },
    { preSelectedId: previousAnswer }
  );

  app.querySelector('#btn-next').onclick = () => {
    currentIndex++;
    if (currentIndex >= questions.length) {
      api.finishSession(session.id).catch(() => {});
      navigate(resultsUrl);
    } else {
      renderCategoryQuestion(app, questions, session, currentIndex, categoryName, categoryId, blockStart, userAnswers);
    }
  };
}


