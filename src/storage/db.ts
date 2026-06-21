import Dexie, { type EntityTable } from 'dexie';
import bundledBank from '../../xi-question-bank.json';
import type { AppBackup, AppSettings, QuestionProgress, QuizBank, QuizSession } from '../domain/quizTypes';

export class QuizHelperDb extends Dexie {
  banks!: EntityTable<QuizBank, 'bankId'>;
  progress!: EntityTable<QuestionProgress, 'key'>;
  sessions!: EntityTable<QuizSession, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('quiz-helper');
    this.version(1).stores({
      banks: 'bankId, title, subject, locale',
      progress: 'key, bankId, questionId, status',
      sessions: 'id, bankId, createdAt',
      settings: 'id'
    });
  }
}

export const db = new QuizHelperDb();

export const defaultSettings: AppSettings = {
  id: 'settings',
  preserveOptionOrder: true,
  showAllQuestions: true
};

export const ensureSeedData = async () => {
  const [bankCount, settings] = await Promise.all([db.banks.count(), db.settings.get('settings')]);
  if (!settings) {
    await db.settings.put(defaultSettings);
  }
  if (bankCount === 0) {
    await db.banks.put(bundledBank as QuizBank);
  }
};

export const exportBackup = async (): Promise<AppBackup> => {
  const [banks, progress, sessions, settings] = await Promise.all([
    db.banks.toArray(),
    db.progress.toArray(),
    db.sessions.toArray(),
    db.settings.get('settings')
  ]);
  return {
    format: 'quiz-helper-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    banks,
    progress,
    sessions,
    settings: settings ?? defaultSettings
  };
};

export const restoreBackup = async (backup: AppBackup) => {
  await db.transaction('rw', db.banks, db.progress, db.sessions, db.settings, async () => {
    await Promise.all([db.banks.clear(), db.progress.clear(), db.sessions.clear(), db.settings.clear()]);
    await db.banks.bulkPut(backup.banks);
    await db.progress.bulkPut(backup.progress);
    await db.sessions.bulkPut(backup.sessions);
    await db.settings.put(backup.settings ?? defaultSettings);
  });
};

export const removeBank = async (bankId: string) => {
  await db.transaction('rw', db.banks, db.progress, db.sessions, async () => {
    await db.banks.delete(bankId);
    await db.progress.where('bankId').equals(bankId).delete();
    await db.sessions.where('bankId').equals(bankId).delete();
  });
};
