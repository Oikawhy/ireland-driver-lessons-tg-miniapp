/**
 * Marathon page — all questions, instant feedback + explanation.
 * Back button to return to previous question and switch answer.
 */
import { t } from '../i18n/index.js';
import { state, saveState } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';
import { renderQuestionCard, showFeedback, disableAnswers } from '../components/questionCard.js';

let session = null;
let questions = [];
let currentIndex = 0;
let autoNextTimeout = null;
let userAnswers = {}; // { questionId: answerId }

export async function marathonPage(app) {
  app.innerHTML = '<div class="spinner"></div>';

  // Check for paused session
  const paused = state.pausedSession;
  if (paused && paused.mode === 'marathon') {
    try {
      questions = paused.questions;
      session = { id: paused.sessionId };
      currentIndex = paused.currentIndex;
      userAnswers = paused.userAnswers || {};
      state.pausedSession = null;
      saveState();
      renderMarathonQuestion(app);
      return () => { if (autoNextTimeout) clearTimeout(autoNextTimeout); };
    } catch (e) {
      state.pausedSession = null;
      saveState();
    }
  }

  try {
    [questions, session] = await Promise.all([
      api.getQuestions('marathon'),
      api.createSession('marathon'),
    ]);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  currentIndex = 0;
  userAnswers = {};
  renderMarathonQuestion(app);
  return () => { if (autoNextTimeout) clearTimeout(autoNextTimeout); };
}

function renderMarathonQuestion(app) {
  const q = questions[currentIndex];
  const previousAnswer = userAnswers[q.id];

  app.innerHTML = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        ${currentIndex > 0 ? '<button class="btn-close" id="btn-prev" title="Previous">&lt;</button>' : '<div></div>'}
        <div class="quiz-progress">${t('marathon.question', { n: currentIndex + 1, total: questions.length })}</div>
        <div class="quiz-topbar-actions">
          <button class="btn-close" id="btn-pause" title="Pause">⏸</button>
          <button class="btn-close" id="btn-quit" title="Close">✕</button>
        </div>
      </div>
      <div class="quiz-progress-bar"><div class="fill" style="width:${((currentIndex + 1) / questions.length) * 100}%"></div></div>
      <div id="question-container"></div>
      <div class="quiz-bottom" id="quiz-bottom" style="display:none;">
        <button class="btn btn-primary" id="btn-next">${t('common.next')}</button>
      </div>
    </div>
  `;

  // Close button
  app.querySelector('#btn-quit').onclick = async () => {
    if (autoNextTimeout) clearTimeout(autoNextTimeout);
    try { await api.finishSession(session.id); } catch (e) {}
    navigate(`results?session=${session.id}&mode=marathon`);
  };

  // Back button
  const prevBtn = app.querySelector('#btn-prev');
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (autoNextTimeout) clearTimeout(autoNextTimeout);
      currentIndex--;
      renderMarathonQuestion(app);
    };
  }

  // Pause button
  app.querySelector('#btn-pause').onclick = () => {
    if (autoNextTimeout) clearTimeout(autoNextTimeout);
    state.pausedSession = {
      sessionId: session.id,
      mode: 'marathon',
      currentIndex,
      questions,
      userAnswers,
    };
    saveState();
    window._haptic?.('impact');
    navigate('menu');
  };

  renderQuestionCard(
    app.querySelector('#question-container'),
    q,
    true, // show bookmark
    async (answerId) => {
      userAnswers[q.id] = answerId;
      try {
        const result = await api.submitAnswer(session.id, q.id, answerId);
        showFeedback(app, q, answerId, result, { showHintBtn: true });

        window._haptic?.(result.is_correct ? 'success' : 'error');

        // Show next button
        const bottom = app.querySelector('#quiz-bottom');
        bottom.style.display = 'flex';

        // Auto-next
        const autoNext = state.settings.marathon_auto_next;
        if (autoNext > 0) {
          autoNextTimeout = setTimeout(() => advanceNext(app), autoNext * 1000);
        }
      } catch (e) { console.error(e); }
    },
    { preSelectedId: previousAnswer }
  );

  const nextBtn = app.querySelector('#btn-next');
  if (nextBtn) nextBtn.onclick = () => advanceNext(app);
}

function advanceNext(app) {
  if (autoNextTimeout) clearTimeout(autoNextTimeout);
  currentIndex++;
  if (currentIndex >= questions.length) {
    api.finishSession(session.id).catch(() => {});
    navigate(`results?session=${session.id}&mode=marathon`);
  } else {
    renderMarathonQuestion(app);
  }
}
