import { describe, test, expect } from 'vitest';
import { t, setLang, getLang } from '../../src/i18n/index.js';

describe('i18n', () => {
  test('returns English key by default', () => {
    setLang('en');
    expect(t('menu.exam')).toBe('Exam');
  });

  test('switches to Russian', () => {
    setLang('ru');
    expect(t('menu.exam')).toBe('Экзамен');
    expect(t('exam.congrats')).toBe('ПОЗДРАВЛЯЕМ!');
  });

  test('switches back to English', () => {
    setLang('en');
    expect(t('menu.exam')).toBe('Exam');
  });

  test('interpolates numeric params', () => {
    setLang('en');
    expect(t('exam.question', { n: 5, total: 40 })).toBe('Question 5/40');
  });

  test('interpolates Russian params', () => {
    setLang('ru');
    expect(t('exam.question', { n: 5, total: 40 })).toBe('Вопрос 5/40');
  });

  test('returns key path for missing translations', () => {
    setLang('en');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  test('returns key path for deeply missing nested key', () => {
    setLang('en');
    expect(t('menu.nonexistent.deep.key')).toBe('menu.nonexistent.deep.key');
  });

  test('falls back to English for unknown language', () => {
    setLang('xx');
    expect(getLang()).toBe('en');
    expect(t('menu.exam')).toBe('Exam');
  });

  test('handles empty params object', () => {
    setLang('en');
    expect(t('menu.exam', {})).toBe('Exam');
  });

  test('translates all main sections', () => {
    setLang('en');
    expect(t('settings.title')).toBe('Settings');
    expect(t('bookmarks.title')).toBe('Bookmarks');
    expect(t('results.title')).toBe('Results');
    expect(t('stats.examsTaken')).toBe('Exams');
    expect(t('common.next')).toBe('Next ➡️');
  });

  test('Russian translations for all main sections', () => {
    setLang('ru');
    expect(t('settings.title')).toBe('Настройки');
    expect(t('bookmarks.title')).toBe('Закладки');
    expect(t('results.title')).toBe('Результаты');
    expect(t('stats.examsTaken')).toBe('Экзамены');
    expect(t('common.next')).toBe('Далее ➡️');
  });
});
