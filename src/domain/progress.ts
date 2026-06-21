import type { ProgressStatus, Question, QuestionProgress } from './quizTypes';

export const progressKey = (bankId: string, questionId: string) => `${bankId}::${questionId}`;

export const sortIds = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b));

export const answersMatch = (selectedOptionIds: string[], correctOptionIds: string[]) => {
  const selected = sortIds(selectedOptionIds);
  const correct = sortIds(correctOptionIds);
  return selected.length === correct.length && selected.every((id, index) => id === correct[index]);
};

export const markQuestion = (
  bankId: string,
  question: Question,
  selectedOptionIds: string[],
  existing?: QuestionProgress
): QuestionProgress => {
  const correct = answersMatch(selectedOptionIds, question.answer.correctOptionIds);
  const status: ProgressStatus = correct ? 'correct' : 'wrong';
  return {
    key: progressKey(bankId, question.id),
    bankId,
    questionId: question.id,
    status,
    latestSelectedOptionIds: sortIds(selectedOptionIds),
    latestCorrectOptionIds: sortIds(question.answer.correctOptionIds),
    attempts: (existing?.attempts ?? 0) + 1,
    lastAnsweredAt: new Date().toISOString()
  };
};

export const getStatus = (progress?: QuestionProgress): ProgressStatus => progress?.status ?? 'unanswered';
