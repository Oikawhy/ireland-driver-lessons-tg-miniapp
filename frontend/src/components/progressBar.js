/**
 * Progress bar component.
 */

/**
 * Create a progress bar element.
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {string} HTML string
 */
export function progressBar(current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return `
    <div class="quiz-progress-bar">
      <div class="fill" style="width:${pct}%"></div>
    </div>
  `;
}

/**
 * Create a stats card element.
 * @param {string} value
 * @param {string} label
 * @param {string} variant - '', 'accent', 'warn', 'danger'
 * @returns {string} HTML
 */
export function statsCard(value, label, variant = '') {
  return `
    <div class="stat-card ${variant}">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}
