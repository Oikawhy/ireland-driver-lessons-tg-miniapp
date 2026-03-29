/**
 * Incorrect page — SRS-powered review of mistakes.
 * FIX #2: ✕ close button bigger.
 * FIX #3: Pause button saves progress.
 * FIX #4: Explanation as collapsible button + 2 hints (hint + explanation).
 */
import { t } from '../i18n/index.js';
import { state, saveState } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';
import { renderQuestionCard, showFeedback, disableAnswers } from '../components/questionCard.js';

let cards = [];
let currentIndex = 0;

export async function incorrectPage(app) {
  app.innerHTML = '<div class="spinner"></div>';

  // FIX #3: Check for paused session
  const paused = state.pausedSession;
  if (paused && paused.mode === 'incorrect') {
    cards = paused.questions;
    currentIndex = paused.currentIndex;
    state.pausedSession = null;
    saveState();
    renderIncorrectQuestion(app);
    return;
  }

  try {
    cards = await api.getDueCards();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  if (cards.length === 0) {
    app.innerHTML = `
      <div class="empty-state fade-in">
        <div class="emoji">🎉</div>
        <p>${t('incorrect.noCards')}</p>
        <button class="btn btn-primary" style="margin-top:16px;" id="btn-back">${t('common.back')}</button>
      </div>
    `;
    app.querySelector('#btn-back').onclick = () => navigate('menu');
    return;
  }

  // Shuffle cards randomly
  cards.sort(() => Math.random() - 0.5);

  currentIndex = 0;
  renderIncorrectQuestion(app);
}

function renderIncorrectQuestion(app) {
  const card = cards[currentIndex];
  const q = card.question;

  app.innerHTML = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        <div class="quiz-progress">${t('exam.question', { n: currentIndex + 1, total: cards.length })}</div>
        <div class="quiz-topbar-actions">
          <button class="btn-close" id="btn-pause" title="Pause">⏸</button>
          <button class="btn-close" id="btn-quit" title="Close">✕</button>
        </div>
      </div>
      <div class="quiz-progress-bar"><div class="fill" style="width:${((currentIndex + 1) / cards.length) * 100}%"></div></div>
      <div id="question-container"></div>
      <div class="quiz-bottom" id="quiz-bottom" style="display:none;">
        <button class="btn btn-primary" id="btn-next">${t('common.next')}</button>
      </div>
    </div>
  `;

  // FIX #2: Close button
  app.querySelector('#btn-quit').onclick = () => navigate('menu');

  // FIX #3: Pause button
  app.querySelector('#btn-pause').onclick = () => {
    state.pausedSession = {
      mode: 'incorrect',
      currentIndex,
      questions: cards,
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
      const isCorrect = q.answers.find(a => a.id === answerId)?.is_correct;

      // Review the SRS card
      try {
        await api.reviewCard(q.id, isCorrect);
      } catch (e) { console.error(e); }

      // FIX #4: Show feedback with hint+explanation buttons (not auto-shown)
      const result = { is_correct: isCorrect, correct_answer_id: q.answers.find(a => a.is_correct)?.id };
      showFeedback(app, q, answerId, result, { showHintBtn: true });
      window._haptic?.(isCorrect ? 'success' : 'error');

      app.querySelector('#quiz-bottom').style.display = 'flex';
    }
  );

  const nextBtn = app.querySelector('#btn-next');
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentIndex++;
      if (currentIndex >= cards.length) {
        navigate('menu');
      } else {
        renderIncorrectQuestion(app);
      }
    };
  }
}
