import { useEffect, useState } from 'react';
import { db, defaultSettings, ensureSeedData } from '../storage/db';
import type { AppSettings, QuestionProgress, QuizBank, QuizSession } from '../domain/quizTypes';

export interface AppData {
  banks: QuizBank[];
  progress: QuestionProgress[];
  sessions: QuizSession[];
  settings: AppSettings;
}

export const useDbData = () => {
  const [data, setData] = useState<AppData>({
    banks: [],
    progress: [],
    sessions: [],
    settings: defaultSettings
  });
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await ensureSeedData();
      const [banks, progress, sessions, settings] = await Promise.all([
        db.banks.toArray(),
        db.progress.toArray(),
        db.sessions.toArray(),
        db.settings.get('settings')
      ]);
      if (!cancelled) {
        setData({ banks, progress, sessions, settings: { ...defaultSettings, ...(settings ?? {}) } });
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return {
    data,
    loading,
    refresh: () => setRefreshToken((token) => token + 1)
  };
};
