import Ajv2020 from 'ajv/dist/2020';
import schema from '../../quiz-bank.schema.json';
import type { AppBackup, QuizBank } from '../domain/quizTypes';

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile<QuizBank>(schema);

export const validateQuizBank = (data: unknown): { ok: true; bank: QuizBank } | { ok: false; errors: string[] } => {
  if (validate(data)) {
    return { ok: true, bank: data };
  }
  return {
    ok: false,
    errors: (validate.errors ?? []).map((error) => `${error.instancePath || 'bank'} ${error.message ?? 'is invalid'}`)
  };
};

export const parseJsonFile = async (file: File) => JSON.parse(await file.text()) as unknown;

export const isAppBackup = (data: unknown): data is AppBackup => {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<AppBackup>;
  return (
    candidate.format === 'quiz-helper-backup' &&
    candidate.version === 1 &&
    Array.isArray(candidate.banks) &&
    Array.isArray(candidate.progress) &&
    Array.isArray(candidate.sessions) &&
    Boolean(candidate.settings)
  );
};

export const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
