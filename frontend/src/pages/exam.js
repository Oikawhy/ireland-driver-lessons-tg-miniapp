/**
 * Exam page — 40 random questions, timed, no instant feedback.
 * FIX #7: Timer no longer flashes full time on question change.
 * FIX #8: ← button to go back and change answer.
 * FIX #2: ✕ close button in topbar.
 */
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import * as api from '../api.js';
import { renderQuestionCard, disableAnswers } from '../components/questionCard.js';
import { startTimer, stopTimer, formatTime } from '../components/timer.js';

let session = null;
let questions = [];
let currentIndex = 0;
let timerInterval = null;
let examStartTime = null;
let examTimeLimit = null;
let userAnswers = {}; // { questionId: answerId }

export async function examPage(app) {
  app.innerHTML = '<div class="spinner"></div>';

  try {
    [questions, session] = await Promise.all([
      api.getQuestions('exam'),
      api.createSession('exam', null, state.settings.exam_time_limit),
    ]);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  currentIndex = 0;
  userAnswers = {};
  examStartTime = Date.now();
  examTimeLimit = session.time_limit_sec || state.settings.exam_time_limit || 2400;

  renderExamQuestion(app);

  // Start timer (FIX #7: uses examStartTime, not re-created per question)
  timerInterval = startTimer(examTimeLimit, (remaining) => {
    const timerEl = app.querySelector('.quiz-timer');
    if (timerEl) {
      // FIX #7: Calculate ACTUAL remaining from start time
      const elapsed = (Date.now() - examStartTime) / 1000;
      const actual = Math.max(0, examTimeLimit - elapsed);
      timerEl.textContent = formatTime(actual);
      if (actual <= 60) timerEl.className = 'quiz-timer danger';
      else if (actual <= 300) timerEl.className = 'quiz-timer warning';
    }
  }, async () => {
    // Time's up
    try { await api.finishSession(session.id); } catch (e) {}
    navigate(`results?session=${session.id}&mode=exam`);
  });

  return () => { stopTimer(timerInterval); };
}

function renderExamQuestion(app) {
  const q = questions[currentIndex];

  // FIX #7: Calculate ACTUAL remaining time, not total
  const elapsed = (Date.now() - examStartTime) / 1000;
  const actualRemaining = Math.max(0, examTimeLimit - elapsed);

  // FIX #8: Check if question was previously answered
  const previousAnswer = userAnswers[q.id];

  app.innerHTML = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        ${currentIndex > 0 ? '<button class="btn-close" id="btn-prev" title="Previous">&lt;</button>' : '<div></div>'}
        <div class="quiz-progress">${t('exam.question', { n: currentIndex + 1, total: questions.length })}</div>
        <div class="quiz-timer">${formatTime(actualRemaining)}</div>
        <button class="btn-close" id="btn-quit" title="Close">✕</button>
      </div>
      <div class="quiz-progress-bar"><div class="fill" style="width:${((currentIndex + 1) / questions.length) * 100}%"></div></div>
      <div id="question-container"></div>
    </div>
  `;

  // FIX #2: Close button discards session
  app.querySelector('#btn-quit').onclick = async () => {
    stopTimer(timerInterval);
    try { await api.finishSession(session.id); } catch (e) {}
    navigate(`results?session=${session.id}&mode=exam`);
  };

  // FIX #8: Back button
  const prevBtn = app.querySelector('#btn-prev');
  if (prevBtn) {
    prevBtn.onclick = () => {
      currentIndex--;
      renderExamQuestion(app);
    };
  }

  renderQuestionCard(
    app.querySelector('#question-container'),
    q,
    false, // no bookmark in exam
    async (answerId) => {
      // Store answer locally for back navigation
      userAnswers[q.id] = answerId;

      try {
        await api.submitAnswer(session.id, q.id, answerId);
      } catch (e) { console.error(e); }

      disableAnswers(app);
      currentIndex++;

      if (currentIndex >= questions.length) {
        stopTimer(timerInterval);
        try { await api.finishSession(session.id); } catch (e) {}
        navigate(`results?session=${session.id}&mode=exam`);
      } else {
        setTimeout(() => renderExamQuestion(app), 200);
      }
    },
    { preSelectedId: previousAnswer, hideHint: true }
  );
}
