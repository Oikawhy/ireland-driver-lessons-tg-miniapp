/**
 * Stats card component — small box for dashboard metrics.
 */

/**
 * Render a stats card.
 * @param {string} value - Display value (e.g., "12", "87%")
 * @param {string} label - Label text
 * @param {string} variant - CSS class variant: '', 'accent', 'warn', 'danger'
 * @returns {string} HTML string
 */
export function statsCard(value, label, variant = '') {
  return `
    <div class="stat-card ${variant}">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

/**
 * Render a grid of stats cards.
 * @param {Array} items - [{value, label, variant}]
 * @returns {string} HTML string
 */
export function statsGrid(items) {
  return `
    <div class="stats-grid">
      ${items.map(i => statsCard(i.value, i.label, i.variant || '')).join('')}
    </div>
  `;
}
