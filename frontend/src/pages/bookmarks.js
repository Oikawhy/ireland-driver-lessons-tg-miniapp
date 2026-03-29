/**
 * Bookmarks page — list saved questions, remove, test all, view question.
 * FIX #9: Test bookmarks button works (shuffled quiz).
 * FIX #9: Click question → answer view with hint/explanation.
 */
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';
import { renderQuestionCard, showFeedback } from '../components/questionCard.js';

export async function bookmarksPage(app) {
  app.innerHTML = '<div class="spinner"></div>';

  let bookmarks = [];
  try {
    bookmarks = await api.getBookmarks();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  if (bookmarks.length === 0) {
    app.innerHTML = `
      <div class="settings-page fade-in">
        <div class="page-header">
          <button class="btn-back" id="btn-back">&lt;</button>
          <h2>${t('bookmarks.title')}</h2>
        </div>
        <div class="empty-state">
          <div class="emoji">🔖</div>
          <p>${t('bookmarks.empty')}</p>
          <p style="margin-top:4px;">${t('bookmarks.emptyHint')}</p>
        </div>
      </div>
    `;
    app.querySelector('#btn-back').onclick = () => navigate('menu');
    return;
  }

  app.innerHTML = `
    <div class="settings-page fade-in">
      <div class="page-header">
        <button class="btn-back" id="btn-back">&lt;</button>
        <h2>${t('bookmarks.title')} (${bookmarks.length})</h2>
      </div>
      <div id="bookmark-list"></div>
      <button class="btn btn-primary" id="btn-test" style="margin-top:8px;">${t('bookmarks.testAll')}</button>
    </div>
  `;

  app.querySelector('#btn-back').onclick = () => navigate('menu');

  // FIX #9: Test bookmarks button — starts shuffled quiz
  app.querySelector('#btn-test').onclick = () => {
    window._haptic?.('impact');
    const shuffled = [...bookmarks]
      .filter(bm => bm.question)
      .sort(() => Math.random() - 0.5);

    if (shuffled.length === 0) return;
    startBookmarkQuiz(app, shuffled);
  };

  const list = app.querySelector('#bookmark-list');
  bookmarks.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'card bookmark-item';
    item.dataset.testid = 'bookmark-item';
    item.innerHTML = `
      <div class="bookmark-content" data-qid="${bm.question_id}">
        <div style="font-weight:600;font-size:var(--text-sm);margin-bottom:4px;">
          #${bm.question?.source_id || bm.question_id} ${bm.question?.question_text || ''}
        </div>
        ${bm.question?.category_name ? `<span class="badge badge-gray">${bm.question.category_name}</span>` : ''}
      </div>
      <button class="btn btn-ghost btn-icon btn-remove" data-qid="${bm.question_id}" style="color:var(--wrong);flex-shrink:0;">✕</button>
    `;

    // FIX #9: Click question → open answer view
    item.querySelector('.bookmark-content').onclick = () => {
      if (bm.question) {
        showBookmarkQuestion(app, bm.question, bookmarks);
      }
    };

    // Remove button
    const removeBtn = item.querySelector('.btn-remove');
    removeBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await api.removeBookmark(bm.question_id);
        item.remove();
        state.bookmarks.delete(bm.question_id);
        window._haptic?.('impact');
        const h2 = app.querySelector('h2');
        const remaining = list.children.length;
        h2.textContent = `${t('bookmarks.title')} (${remaining})`;
        if (remaining === 0) bookmarksPage(app);
      } catch (e) { console.error(e); }
    };

    list.appendChild(item);
  });
}

/** Show a single bookmarked question with answer choices and hint/explanation */
function showBookmarkQuestion(app, question, allBookmarks) {
  app.innerHTML = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        <button class="btn-close" id="btn-back-list" title="Back">&lt;</button>
        <div class="quiz-progress">#${question.source_id || question.id}</div>
        <div></div>
      </div>
      ${question.category_name ? `<div class="question-category">${question.category_name}</div>` : ''}
      <div id="question-container"></div>
    </div>
  `;

  app.querySelector('#btn-back-list').onclick = () => bookmarksPage(app);

  renderQuestionCard(
    app.querySelector('#question-container'),
    question,
    false,
    (answerId) => {
      const isCorrect = question.answers?.find(a => a.id === answerId)?.is_correct;
      const result = {
        is_correct: isCorrect,
        correct_answer_id: question.answers?.find(a => a.is_correct)?.id,
        explanation: question.explanation,
      };
      showFeedback(app, question, answerId, result, { showHintBtn: true });
    }
  );
}

/** Shuffled bookmark quiz */
function startBookmarkQuiz(app, bookmarks) {
  let idx = 0;

  function renderNext() {
    if (idx >= bookmarks.length) {
      bookmarksPage(app);
      return;
    }

    const bm = bookmarks[idx];
    const q = bm.question;

    app.innerHTML = `
      <div class="quiz-page fade-in">
        <div class="quiz-topbar">
          <div class="quiz-progress">${t('exam.question', { n: idx + 1, total: bookmarks.length })}</div>
          <button class="btn-close" id="btn-quit" title="Close">✕</button>
        </div>
        <div class="quiz-progress-bar"><div class="fill" style="width:${((idx + 1) / bookmarks.length) * 100}%"></div></div>
        <div id="question-container"></div>
        <div class="quiz-bottom" id="quiz-bottom" style="display:none;">
          <button class="btn btn-primary" id="btn-next">${t('common.next')}</button>
        </div>
      </div>
    `;

    app.querySelector('#btn-quit').onclick = () => bookmarksPage(app);

    renderQuestionCard(
      app.querySelector('#question-container'),
      q,
      false,
      (answerId) => {
        const isCorrect = q.answers?.find(a => a.id === answerId)?.is_correct;
        const result = {
          is_correct: isCorrect,
          correct_answer_id: q.answers?.find(a => a.is_correct)?.id,
          explanation: q.explanation,
        };
        showFeedback(app, q, answerId, result, { showHintBtn: true });
        window._haptic?.(isCorrect ? 'success' : 'error');
        app.querySelector('#quiz-bottom').style.display = 'flex';
      }
    );

    app.querySelector('#btn-next').onclick = () => {
      idx++;
      renderNext();
    };
  }

  renderNext();
}
