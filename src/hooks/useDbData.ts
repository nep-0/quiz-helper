import { useEffect, useRef, useState } from 'react';
import { db, defaultSettings, ensureSeedData } from '../storage/db';
import type { ActiveSessionState, AppSettings, QuestionProgress, QuizBank, QuizSession } from '../domain/quizTypes';

export interface AppData {
  banks: QuizBank[];
  progress: QuestionProgress[];
  sessions: QuizSession[];
  settings: AppSettings;
  activeSessions: ActiveSessionState[];
}

export const useDbData = () => {
  const [data, setData] = useState<AppData>({
    banks: [],
    progress: [],
    sessions: [],
    settings: defaultSettings,
    activeSessions: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!hasLoaded.current) {
        setLoading(true);
      }
      await ensureSeedData();
      const [banks, progress, sessions, settings, activeSessions] = await Promise.all([
        db.banks.toArray(),
        db.progress.toArray(),
        db.sessions.toArray(),
        db.settings.get('settings'),
        db.activeSession.toArray()
      ]);
      if (!cancelled) {
        setData({ banks, progress, sessions, settings: { ...defaultSettings, ...(settings ?? {}) }, activeSessions });
        hasLoaded.current = true;
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
