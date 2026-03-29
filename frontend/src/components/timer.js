/**
 * Timer component — countdown for exam mode.
 */

/**
 * Format seconds to MM:SS.
 */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Check if an exam has expired.
 */
export function isExpired(startTimestamp, timeLimitSec) {
  const elapsed = (Date.now() - startTimestamp) / 1000;
  return elapsed >= timeLimitSec;
}

/**
 * Start a countdown timer.
 * @param {number} totalSeconds - Total seconds for countdown
 * @param {Function} onTick - Callback(remainingSeconds) every second
 * @param {Function} onExpire - Callback when timer reaches 0
 * @returns {number} Interval ID
 */
export function startTimer(totalSeconds, onTick, onExpire) {
  const startTime = Date.now();

  const id = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, totalSeconds - elapsed);

    onTick(remaining);

    if (remaining <= 0) {
      clearInterval(id);
      onExpire();
    }
  }, 1000);

  // Immediate first tick
  onTick(totalSeconds);

  return id;
}

/**
 * Stop a timer.
 */
export function stopTimer(intervalId) {
  if (intervalId) clearInterval(intervalId);
}
