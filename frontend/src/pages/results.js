/**
 * Results page — score, accuracy, time, pass/fail, review answers.
 * Review items are expandable — click to see full question with image.
 * Back from expanded question returns to the same position in review list.
 */
import { t } from '../i18n/index.js';
import { navigate } from '../router.js';
import * as api from '../api.js';

export async function resultsPage(app, params) {
  app.innerHTML = '<div class="spinner"></div>';

  const sessionId = params?.session;
  const mode = params?.mode || 'exam';
  const blockStart = params?.blockStart !== undefined ? parseInt(params.blockStart) : null;
  const blockSize = params?.blockSize !== undefined ? parseInt(params.blockSize) : null;

  if (!sessionId) {
    app.innerHTML = '<div class="empty-state"><div class="emoji">🤷</div><p>No session</p></div>';
    return;
  }

  let results;
  try {
    results = await api.getResults(sessionId);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
    return;
  }

  // If category block mode, filter questions to just the block
  let displayQuestions = results.questions || [];
  let correct, total;

  if (mode === 'category' && blockStart !== null && blockSize !== null) {
    // Only show stats for the block the user actually answered
    displayQuestions = displayQuestions.slice(0, blockSize);
    correct = displayQuestions.filter(q => q.user_correct).length;
    total = displayQuestions.length || 1;
  } else {
    correct = results.correct_count || 0;
    total = results.total_questions || 1;
  }

  const accuracy = Math.round((correct / total) * 100);
  const isPassed = mode === 'exam' ? correct >= 35 : accuracy >= 70;
  const isExam = mode === 'exam';

  // Calculate time
  let timeStr = '';
  if (results.started_at && results.finished_at) {
    const elapsed = Math.round((new Date(results.finished_at) - new Date(results.started_at)) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
  }

  // Score circle
  const circumference = 2 * Math.PI * 58;
  const offset = circumference * (1 - correct / total);

  // Store for review navigation
  const reviewData = { ...results, questions: displayQuestions };

  renderResultsView(app, {
    correct, total, accuracy, isPassed, isExam, timeStr, circumference, offset,
    reviewData, mode, blockStart, blockSize, sessionId
  });
}

function renderResultsView(app, ctx, scrollToIdx = null) {
  const { correct, total, accuracy, isPassed, isExam, timeStr, circumference, offset, reviewData, mode } = ctx;

  app.innerHTML = `
    <div class="results-page fade-in">
      <div class="results-header">
        <div class="results-emoji">${isExam ? (isPassed ? '🎉' : '😔') : (accuracy >= 85 ? '⭐' : '📊')}</div>
        <div class="results-title ${isPassed ? 'pass' : 'fail'}" data-testid="results-score">
          ${isExam ? (isPassed ? t('exam.congrats') : t('exam.failed')) : t('results.title')}
        </div>
        <div class="results-score" data-testid="results-score">${correct}/${total}</div>
        ${isExam ? `<p style="color:var(--hint);font-size:var(--text-sm);margin-top:8px;">${isPassed ? t('exam.passed') : t('exam.notPassed')}</p>` : ''}
      </div>

      <div class="score-circle">
        <svg viewBox="0 0 128 128">
          <circle class="bg" cx="64" cy="64" r="58"></circle>
          <circle class="fill ${isPassed ? 'pass' : 'fail'}" cx="64" cy="64" r="58"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="score-text">
          <span>${accuracy}%</span>
          <span class="score-label">${t('results.accuracy')}</span>
        </div>
      </div>

      <div class="results-stats">
        <div class="results-stat">
          <div class="value" style="color:var(--correct)">${correct}</div>
          <div class="label">${t('results.correct')}</div>
        </div>
        <div class="results-stat">
          <div class="value" style="color:var(--wrong)">${total - correct}</div>
          <div class="label">${t('results.wrong')}</div>
        </div>
        ${timeStr ? `
        <div class="results-stat">
          <div class="value">${timeStr}</div>
          <div class="label">${t('results.time')}</div>
        </div>` : ''}
      </div>

      <div id="review-container"></div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        <button class="btn-back-menu" id="btn-menu">${t('results.backToMenu')}</button>
        <button class="btn btn-secondary" id="btn-review">${t('results.review')}</button>
      </div>
    </div>
  `;

  app.querySelector('#btn-menu').onclick = () => navigate('menu');

  // If scrollToIdx is set, auto-open review and scroll
  if (scrollToIdx !== null) {
    const container = app.querySelector('#review-container');
    renderReview(app, container, reviewData, ctx);
    // Scroll to the question they were viewing
    setTimeout(() => {
      const targetItem = container.querySelector(`[data-qi="${scrollToIdx}"]`);
      if (targetItem) targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  app.querySelector('#btn-review').onclick = () => {
    const container = app.querySelector('#review-container');
    if (container.children.length > 0) {
      container.innerHTML = '';
      return;
    }
    renderReview(app, container, reviewData, ctx);
  };
}

function renderReview(app, container, results, ctx) {
  const items = results.questions || [];
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:16px;">No detailed data available.</p>';
    return;
  }

  let html = '<div class="review-section" style="margin-top:8px;">';
  items.forEach((q, i) => {
    const isCorrect = q.user_correct;
    const icon = isCorrect ? '✅' : '❌';

    const userAnswer = q.answers?.find(a => a.id === q.user_answer_id);
    const correctAnswer = q.answers?.find(a => a.is_correct);

    html += `
      <div class="review-item ${isCorrect ? 'correct' : 'wrong'}" data-qi="${i}" style="cursor:pointer;">
        <div class="review-q">${icon} Q${i + 1}: ${q.question_text || ''}</div>
        <div class="review-a">
          ${userAnswer ? userAnswer.answer_text : ''}
          ${!isCorrect && correctAnswer ? ` → <span style="color:var(--correct)">${correctAnswer.answer_text}</span>` : ''}
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  // Click handler — open expanded question view
  container.querySelectorAll('.review-item').forEach(item => {
    item.onclick = () => {
      const idx = parseInt(item.dataset.qi);
      const q = items[idx];
      showExpandedQuestion(app, q, idx, items, results, ctx);
    };
  });
}

/**
 * Show expanded question with image, answers, hint, explanation, and back button.
 * Back button returns to results with review scrolled to the same question.
 */
function showExpandedQuestion(app, q, idx, items, results, ctx) {
  const isCorrect = q.user_correct;
  const correctAnswer = q.answers?.find(a => a.is_correct);
  const userAnswer = q.answers?.find(a => a.id === q.user_answer_id);

  let html = `
    <div class="quiz-page fade-in">
      <div class="quiz-topbar">
        <button class="btn-close" id="btn-back-review" title="Back">&lt;</button>
        <div class="quiz-progress">Q${idx + 1}/${items.length} ${isCorrect ? '✅' : '❌'}</div>
        <div></div>
      </div>
      <div class="question-card">
  `;

  if (q.image_filename) {
    html += `<img class="question-image" src="/images/${q.image_filename}" alt="Question image" loading="lazy" />`;
  }

  html += `<div class="question-text">${q.question_text || ''}</div>`;
  html += `<div class="answers-list">`;

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  (q.answers || []).forEach((a, i) => {
    let cls = 'answer-btn';
    if (a.id === correctAnswer?.id) cls += ' correct';
    else if (a.id === q.user_answer_id && !isCorrect) cls += ' wrong';
    html += `
      <button class="${cls}" disabled>
        <span class="answer-letter">${LETTERS[i]}</span>
        <span>${a.answer_text}</span>
      </button>
    `;
  });

  html += `</div>`;

  // Show hint if available
  if (q.hint) {
    html += `
      <button class="btn-explanation-toggle" id="btn-hint-toggle">💡 Hint</button>
      <div class="explanation-box hidden" id="hint-box"><p>${q.hint}</p></div>
    `;
  }

  // Show explanation
  if (q.explanation) {
    html += `
      <button class="btn-explanation-toggle" id="btn-expl-toggle">📖 Explanation</button>
      <div class="explanation-box hidden" id="expl-box"><p>${q.explanation}</p></div>
    `;
  }

  html += `</div></div>`;
  app.innerHTML = html;

  // Back button — return to results with review scrolled to the same question
  app.querySelector('#btn-back-review').onclick = () => {
    renderResultsView(app, ctx, idx);
  };

  // Toggle handlers
  app.querySelector('#btn-hint-toggle')?.addEventListener('click', () => {
    app.querySelector('#hint-box')?.classList.toggle('hidden');
  });
  app.querySelector('#btn-expl-toggle')?.addEventListener('click', () => {
    app.querySelector('#expl-box')?.classList.toggle('hidden');
  });
}
