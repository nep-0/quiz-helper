import { describe, expect, it } from 'vitest';
import { buildOptionOrderByQuestion } from './App';
import type { Question } from './domain/quizTypes';

const makeQuestion = (type: Question['type']): Question => ({
  id: type,
  number: 1,
  type,
  prompt: 'Prompt',
  options: [
    { id: 'A', label: 'A', text: 'First' },
    { id: 'B', label: 'B', text: 'Second' }
  ],
  answer: { correctOptionIds: ['A'] }
});

describe('buildOptionOrderByQuestion', () => {
  it('does not shuffle true/false questions', () => {
    const question = makeQuestion('true_false');
    expect(buildOptionOrderByQuestion([question], false)).toEqual({ true_false: ['A', 'B'] });
  });

  it('preserves all option order when requested', () => {
    const question = makeQuestion('single_choice');
    expect(buildOptionOrderByQuestion([question], true)).toEqual({ single_choice: ['A', 'B'] });
  });
});
