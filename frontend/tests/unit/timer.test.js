import { describe, test, expect } from 'vitest';
import { formatTime, isExpired } from '../../src/components/timer.js';

describe('formatTime', () => {
  test('formats 2400 seconds to 40:00', () => {
    expect(formatTime(2400)).toBe('40:00');
  });

  test('formats 61 seconds to 01:01', () => {
    expect(formatTime(61)).toBe('01:01');
  });

  test('formats 0 seconds to 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('formats 3599 seconds to 59:59', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  test('handles single-digit minutes and seconds', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  test('handles negative input as 00:00', () => {
    expect(formatTime(-10)).toBe('00:00');
  });

  test('handles decimal seconds by flooring', () => {
    expect(formatTime(61.7)).toBe('01:01');
  });
});

describe('isExpired', () => {
  test('returns true when elapsed exceeds time limit', () => {
    const start = Date.now() - 2401000; // 2401 seconds ago
    expect(isExpired(start, 2400)).toBe(true);
  });

  test('returns false during active exam', () => {
    const start = Date.now() - 1000; // 1 second ago
    expect(isExpired(start, 2400)).toBe(false);
  });

  test('returns true at exactly the limit', () => {
    const start = Date.now() - 2400000; // exactly 2400 seconds ago
    expect(isExpired(start, 2400)).toBe(true);
  });

  test('returns false at just under the limit', () => {
    const start = Date.now() - 2399000; // 2399 seconds ago
    expect(isExpired(start, 2400)).toBe(false);
  });
});
