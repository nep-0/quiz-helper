import { describe, expect, it } from 'vitest';
import sampleBank from '../../xi-question-bank.json';
import { availableCounts, buildQuestionPool, defaultFilters, pickRandomQuestions } from './picker';
import type { QuestionProgress, QuizBank } from './quizTypes';

describe('question picker', () => {
  const bank = sampleBank as QuizBank;

  it('counts available question types after filters', () => {
    const pool = buildQuestionPool(bank, new Map<string, QuestionProgress>(), defaultFilters());
    expect(availableCounts(pool)).toEqual({ single_choice: 30, multiple_choice: 5, true_false: 10 });
  });

  it('picks requested counts by type', () => {
    const picked = pickRandomQuestions(bank.questions, { single_choice: 1, multiple_choice: 0, true_false: 1 });
    expect(picked).toHaveLength(2);
    expect(picked.filter((question) => question.type === 'single_choice')).toHaveLength(1);
    expect(picked.filter((question) => question.type === 'true_false')).toHaveLength(1);
  });

  it('orders picked questions by single choice, multiple choice, then true/false', () => {
    const picked = pickRandomQuestions(bank.questions, { single_choice: 1, multiple_choice: 1, true_false: 1 });
    expect(picked.map((question) => question.type)).toEqual(['single_choice', 'multiple_choice', 'true_false']);
  });
});
