import { describe, expect, it } from 'vitest';
import { answersMatch, markQuestion } from './progress';
import type { Question } from './quizTypes';

const question: Question = {
  id: 'q1',
  number: 1,
  type: 'multiple_choice',
  prompt: 'Pick answers',
  options: [
    { id: 'A', label: 'A', text: 'A' },
    { id: 'B', label: 'B', text: 'B' },
    { id: 'C', label: 'C', text: 'C' }
  ],
  answer: { correctOptionIds: ['A', 'C'] }
};

describe('progress marking', () => {
  it('matches multiple choice answers regardless of selection order', () => {
    expect(answersMatch(['C', 'A'], ['A', 'C'])).toBe(true);
    expect(answersMatch(['A'], ['A', 'C'])).toBe(false);
  });

  it('records wrong and correct attempts', () => {
    const wrong = markQuestion('bank', question, ['A']);
    expect(wrong.status).toBe('wrong');
    const correct = markQuestion('bank', question, ['C', 'A'], wrong);
    expect(correct.status).toBe('correct');
    expect(correct.attempts).toBe(2);
  });
});
