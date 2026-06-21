import { describe, expect, it } from 'vitest';
import bundledBank from '../../xi-question-bank.json';
import { validateQuizBank } from './bankValidation';

describe('bundled question bank', () => {
  it('matches the quiz bank schema', () => {
    const result = validateQuizBank(bundledBank);
    expect(result.ok).toBe(true);
  });
});
