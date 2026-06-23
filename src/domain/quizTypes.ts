export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ProgressStatus = 'unanswered' | 'correct' | 'wrong';
export type QuizMode = 'standard' | 'instant';

export interface TypeRule {
  label: string;
  defaultPoints: number;
}

export interface QuizBank {
  bankId: string;
  title: string;
  description?: string;
  version: string;
  locale: string;
  subject?: string;
  tags?: string[];
  questionTypes: Record<QuestionType, TypeRule>;
  sections?: Section[];
  questions: Question[];
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questionIds?: string[];
}

export interface Question {
  id: string;
  number: number;
  sectionId?: string;
  type: QuestionType;
  prompt: string;
  stem?: string;
  points?: number;
  difficulty?: Difficulty;
  tags?: string[];
  source?: {
    importType?: string;
    origin?: string;
    chapter?: string;
  };
  options: Option[];
  answer: {
    correctOptionIds: string[];
  };
  explanation?: string;
}

export interface Option {
  id: string;
  label: string;
  text: string;
}

export interface QuestionProgress {
  key: string;
  bankId: string;
  questionId: string;
  status: ProgressStatus;
  latestSelectedOptionIds: string[];
  latestCorrectOptionIds: string[];
  attempts: number;
  lastAnsweredAt?: string;
}

export interface QuizSession {
  id: string;
  bankId: string;
  questionIds: string[];
  createdAt: string;
  completedAt?: string;
  correctCount: number;
  wrongCount: number;
}

export interface AppSettings {
  id: 'settings';
  preserveOptionOrder: boolean;
  showAllQuestions: boolean;
}

export interface ActiveSessionState {
  id: string;
  sessionId: string;
  bankId: string;
  questionIds: string[];
  index: number;
  selected: Record<string, string[]>;
  marked: Record<string, QuestionProgress>;
  optionOrderByQuestion: Record<string, string[]>;
  createdAt: string;
  showAllQuestions: boolean;
  mode: QuizMode;
}

export interface ActiveSessionState {
  id: string;
  sessionId: string;
  bankId: string;
  questionIds: string[];
  index: number;
  selected: Record<string, string[]>;
  marked: Record<string, QuestionProgress>;
  optionOrderByQuestion: Record<string, string[]>;
  createdAt: string;
  showAllQuestions: boolean;
  mode: QuizMode;
}

export interface AppBackup {
  format: 'quiz-helper-backup';
  version: 1;
  exportedAt: string;
  banks: QuizBank[];
  progress: QuestionProgress[];
  sessions: QuizSession[];
  settings: AppSettings;
  activeSessions: ActiveSessionState[];
}
