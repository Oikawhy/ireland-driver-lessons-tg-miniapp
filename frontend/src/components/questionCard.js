/**
 * Question card component — renders question with image, answers, hint, and bookmark.
 * Hint is shown before answering. Explanation is shown after answering.
 */
import { state } from '../state.js';
import * as api from '../api.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Render a question card into a container.
 * @param {HTMLElement} container
 * @param {Object} question - { id, source_id, question_text, image_filename, answers, explanation, hint }
 * @param {boolean} showBookmark - whether to show bookmark button
 * @param {Function} onAnswer - callback(answerId) when an answer is clicked
 * @param {Object} opts - { preSelectedId, hideHint }
 */
export function renderQuestionCard(container, question, showBookmark, onAnswer, opts = {}) {
  const isBookmarked = state.bookmarks.has(question.id);
  const { preSelectedId } = opts;
  const hintText = question.hint;

  let html = `<div class="question-card-wrapper">`;

  if (showBookmark) {
    html += `<button class="question-bookmark ${isBookmarked ? 'active' : ''}" id="btn-bm" data-testid="btn-bookmark">
      ${isBookmarked ? '🔖' : '🏷️'}
    </button>`;
  }

  html += `<div class="question-card">`;

  if (question.image_filename) {
    html += `<img class="question-image" src="/images/${question.image_filename}" alt="Question image" loading="lazy" />`;
  }

  html += `<div class="question-text" data-testid="question-text">${question.question_text}</div>`;

  html += `<div class="answers-list" id="answers-list">`;

  question.answers.forEach((a, i) => {
    const selected = preSelectedId === a.id ? ' selected' : '';
    html += `
      <button class="answer-btn${selected}" data-aid="${a.id}" data-testid="answer-${i}" id="ans-${a.id}">
        <span class="answer-letter">${LETTERS[i]}</span>
        <span>${a.answer_text}</span>
      </button>
    `;
  });

  html += `</div>`;

  // Show hint BELOW answers (collapsible, hidden by default)
  if (hintText && !opts.hideHint) {
    html += `
      <button class="btn-explanation-toggle btn-hint-toggle" id="btn-hint-toggle">💡 Hint</button>
      <div class="explanation-box hidden" id="hint-box"><p>${hintText}</p></div>
    `;
  }

  // Explanation area (populated after answer)
  html += `<div id="explanation-area"></div>`;
  html += `</div></div>`;
  container.innerHTML = html;

  // Hint toggle handler
  const hintToggle = container.querySelector('#btn-hint-toggle');
  if (hintToggle) {
    hintToggle.addEventListener('click', () => {
      container.querySelector('#hint-box')?.classList.toggle('hidden');
    });
  }

  // Answer click handlers
  container.querySelectorAll('.answer-btn').forEach(btn => {
    btn.onclick = () => {
      const answerId = parseInt(btn.dataset.aid);
      // Remove selected from all, add to clicked
      container.querySelectorAll('.answer-btn').forEach(b => {
        b.classList.remove('selected');
        b.disabled = true;
      });
      btn.classList.add('selected');
      onAnswer(answerId);
    };
  });

  // Bookmark handler
  if (showBookmark) {
    const bmBtn = container.querySelector('#btn-bm');
    if (bmBtn) {
      bmBtn.onclick = async () => {
        const qid = question.id;
        if (state.bookmarks.has(qid)) {
          try { await api.removeBookmark(qid); } catch (e) {}
          state.bookmarks.delete(qid);
          bmBtn.textContent = '🏷️';
          bmBtn.classList.remove('active');
        } else {
          try { await api.addBookmark(qid); } catch (e) {}
          state.bookmarks.add(qid);
          bmBtn.textContent = '🔖';
          bmBtn.classList.add('active');
        }
        window._haptic?.('impact');
      };
    }
  }
}

/**
 * Show correct/wrong feedback on answers.
 * Shows explanation button (collapsible) after answering.
 */
export function showFeedback(app, question, selectedId, result, opts = {}) {
  const correctId = result.correct_answer_id || question.answers.find(a => a.is_correct)?.id;

  app.querySelectorAll('.answer-btn').forEach(btn => {
    const aid = parseInt(btn.dataset.aid);
    if (aid === correctId) {
      btn.classList.add('correct');
    } else if (aid === selectedId && !result.is_correct) {
      btn.classList.add('wrong');
    }
    btn.disabled = true;
  });

  // Show explanation button (collapsible, post-answer)
  const area = app.querySelector('#explanation-area');
  if (area) {
    let btnsHtml = '';
    const explanationText = result.explanation || question.explanation;

    if (explanationText) {
      btnsHtml += `
        <button class="btn-explanation-toggle" id="btn-expl-toggle">📖 Explanation</button>
        <div class="explanation-box hidden" id="expl-box"><p>${explanationText}</p></div>
      `;
    }
    area.innerHTML = btnsHtml;

    area.querySelector('#btn-expl-toggle')?.addEventListener('click', () => {
      area.querySelector('#expl-box')?.classList.toggle('hidden');
    });
  }
}

/**
 * Disable all answer buttons.
 */
export function disableAnswers(app) {
  app.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
}
