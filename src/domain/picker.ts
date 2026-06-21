import { getStatus, progressKey } from './progress';
import type { Difficulty, ProgressStatus, Question, QuestionProgress, QuestionType, QuizBank } from './quizTypes';

export interface QuizFilters {
  types: QuestionType[];
  statuses: ProgressStatus[];
  difficulties: Array<Difficulty | 'unspecified'>;
  sections: string[];
  tags: string[];
  chapters: string[];
  origins: string[];
}

export type TypeCounts = Record<QuestionType, number>;

export const questionTypes: QuestionType[] = ['single_choice', 'multiple_choice', 'true_false'];
export const difficulties: Array<Difficulty | 'unspecified'> = ['easy', 'medium', 'hard', 'unspecified'];
export const statuses: ProgressStatus[] = ['unanswered', 'correct', 'wrong'];

export const emptyCounts = (): TypeCounts => ({
  single_choice: 0,
  multiple_choice: 0,
  true_false: 0
});

export const defaultFilters = (): QuizFilters => ({
  types: [...questionTypes],
  statuses: [...statuses],
  difficulties: [...difficulties],
  sections: [],
  tags: [],
  chapters: [],
  origins: []
});

export const buildQuestionPool = (
  bank: QuizBank,
  progressByKey: Map<string, QuestionProgress>,
  filters: QuizFilters
) => {
  return bank.questions.filter((question) => {
    const status = getStatus(progressByKey.get(progressKey(bank.bankId, question.id)));
    const difficulty = question.difficulty ?? 'unspecified';
    const section = question.sectionId ?? '';
    const tags = question.tags ?? [];
    const chapter = question.source?.chapter ?? '';
    const origin = question.source?.origin ?? '';
    return (
      filters.types.includes(question.type) &&
      filters.statuses.includes(status) &&
      filters.difficulties.includes(difficulty) &&
      (filters.sections.length === 0 || filters.sections.includes(section)) &&
      (filters.tags.length === 0 || tags.some((tag) => filters.tags.includes(tag))) &&
      (filters.chapters.length === 0 || filters.chapters.includes(chapter)) &&
      (filters.origins.length === 0 || filters.origins.includes(origin))
    );
  });
};

export const availableCounts = (questions: Question[]) =>
  questions.reduce<TypeCounts>((counts, question) => {
    counts[question.type] += 1;
    return counts;
  }, emptyCounts());

export const pickRandomQuestions = (pool: Question[], counts: TypeCounts) => {
  const chosen: Question[] = [];
  for (const type of questionTypes) {
    const byType = shuffle(pool.filter((question) => question.type === type));
    chosen.push(...byType.slice(0, counts[type]));
  }
  return chosen;
};

export const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};
