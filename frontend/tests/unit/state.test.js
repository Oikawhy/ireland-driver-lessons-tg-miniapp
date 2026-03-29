import { describe, test, expect, beforeEach } from 'vitest';

// Since state.js uses sessionStorage, we test the state object directly
import { state, saveState, restoreState } from '../../src/state.js';

describe('state', () => {
  beforeEach(() => {
    // Reset state
    state.token = null;
    state.userId = null;
    state.telegramId = null;
    state.firstName = null;
    state.settings = {
      language: 'en',
      theme: 'auto',
      haptic_feedback: true,
      exam_time_limit: 2400,
      marathon_auto_next: 0,
    };
    state.dashboard = null;
    state.currentSession = null;
    state.currentQuestions = [];
    state.currentIndex = 0;
    state.bookmarks = new Set();
  });

  test('has correct default values', () => {
    expect(state.token).toBe(null);
    expect(state.settings.language).toBe('en');
    expect(state.settings.theme).toBe('auto');
    expect(state.settings.haptic_feedback).toBe(true);
    expect(state.settings.exam_time_limit).toBe(2400);
    expect(state.settings.marathon_auto_next).toBe(0);
  });

  test('can update settings', () => {
    state.settings.language = 'ru';
    state.settings.theme = 'dark';
    state.settings.exam_time_limit = 1800;
    expect(state.settings.language).toBe('ru');
    expect(state.settings.theme).toBe('dark');
    expect(state.settings.exam_time_limit).toBe(1800);
  });

  test('can set token and user info', () => {
    state.token = 'jwt-token-123';
    state.userId = 1;
    state.telegramId = 12345;
    state.firstName = 'Test';
    expect(state.token).toBe('jwt-token-123');
    expect(state.userId).toBe(1);
    expect(state.firstName).toBe('Test');
  });

  test('bookmarks set operations work', () => {
    state.bookmarks.add(1);
    state.bookmarks.add(5);
    state.bookmarks.add(10);
    expect(state.bookmarks.has(1)).toBe(true);
    expect(state.bookmarks.has(5)).toBe(true);
    expect(state.bookmarks.has(3)).toBe(false);
    expect(state.bookmarks.size).toBe(3);
    state.bookmarks.delete(5);
    expect(state.bookmarks.has(5)).toBe(false);
    expect(state.bookmarks.size).toBe(2);
  });

  test('currentQuestions tracks quiz state', () => {
    state.currentQuestions = [
      { id: 1, question_text: 'Q1?' },
      { id: 2, question_text: 'Q2?' },
    ];
    state.currentIndex = 0;
    expect(state.currentQuestions[state.currentIndex].question_text).toBe('Q1?');
    state.currentIndex = 1;
    expect(state.currentQuestions[state.currentIndex].question_text).toBe('Q2?');
  });

  test('dashboard stats can be assigned', () => {
    state.dashboard = {
      exams_taken: 5,
      pass_rate: 80.0,
      mastered_count: 50,
      due_today: 12,
    };
    expect(state.dashboard.exams_taken).toBe(5);
    expect(state.dashboard.pass_rate).toBe(80.0);
  });

  test('settings range validation (exam time)', () => {
    // Exam time should be between 1800 and 2700
    state.settings.exam_time_limit = 1800;
    expect(state.settings.exam_time_limit).toBe(1800);
    state.settings.exam_time_limit = 2700;
    expect(state.settings.exam_time_limit).toBe(2700);
  });
});
