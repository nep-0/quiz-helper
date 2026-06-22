import {
  ArrowLeft,
  Check,
  Clipboard,
  Database,
  Download,
  FileJson,
  Filter,
  Play,
  RotateCcw,
  Settings,
  Terminal,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { availableCounts, buildQuestionPool, defaultFilters, emptyCounts, pickRandomQuestions, questionTypes, shuffle, statuses, type QuizFilters, type TypeCounts } from './domain/picker';
import { getStatus, markQuestion, progressKey } from './domain/progress';
import type { ActiveSessionState, AppBackup, ProgressStatus, Question, QuestionProgress, QuestionType, QuizBank, QuizMode } from './domain/quizTypes';
import { FormulaText } from './components/FormulaText';
import { useDbData } from './hooks/useDbData';
import { downloadJson, isAppBackup, parseJsonFile, validateQuizBank } from './importExport/bankValidation';
import { clearActiveSession, db, defaultSettings, exportBackup, removeBank, restoreBackup, saveActiveSession } from './storage/db';

type View = 'banks' | 'practice' | 'data';

interface ActiveQuiz {
  bank: QuizBank;
  questions: Question[];
  index: number;
  selected: Record<string, string[]>;
  marked: Record<string, QuestionProgress>;
  optionOrderByQuestion: Record<string, string[]>;
  sessionId: string;
  createdAt: string;
  showAllQuestions: boolean;
  mode: QuizMode;
}

const labels: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  true_false: 'True/false'
};

const statusLabels: Record<ProgressStatus, string> = {
  unanswered: 'Unanswered',
  correct: 'Correct',
  wrong: 'Wrong'
};

const skillInstallCommand = 'npx skills add https://github.com/nep-0/quiz-helper --skill question-bank-maker';

export const buildOptionOrderByQuestion = (questions: Question[], preserveOptionOrder: boolean) =>
  Object.fromEntries(
    questions.map((question) => [
      question.id,
      (preserveOptionOrder || question.type === 'true_false' ? question.options : shuffle(question.options)).map((option) => option.id)
    ])
  );

const orderedOptions = (question: Question, optionOrder: string[] | undefined) => {
  if (!optionOrder) return question.options;
  const byId = new Map(question.options.map((option) => [option.id, option]));
  return optionOrder.map((id) => byId.get(id)).filter((option): option is Question['options'][number] => Boolean(option));
};

function App() {
  const { data, loading, refresh } = useDbData();
  const [view, setView] = useState<View>('banks');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [message, setMessage] = useState('');
  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null);
  const [wrongReviewBank, setWrongReviewBank] = useState<QuizBank | null>(null);

  const selectedBank = data.banks.find((bank) => bank.bankId === selectedBankId) ?? data.banks[0];
  const progressByKey = useMemo(() => new Map(data.progress.map((item) => [item.key, item])), [data.progress]);

  useEffect(() => {
    if (!quiz) return;
    void saveActiveSession({
      id: 'current',
      sessionId: quiz.sessionId,
      bankId: quiz.bank.bankId,
      questionIds: quiz.questions.map((item) => item.id),
      index: quiz.index,
      selected: quiz.selected,
      marked: quiz.marked,
      optionOrderByQuestion: quiz.optionOrderByQuestion,
      createdAt: quiz.createdAt,
      showAllQuestions: quiz.showAllQuestions,
      mode: quiz.mode
    });
  }, [quiz]);

  const resumeSession = async () => {
    const state = data.activeSession;
    if (!state) return;
    const bank = data.banks.find((item) => item.bankId === state.bankId);
    if (!bank) {
      await clearActiveSession();
      refresh();
      notify('Saved session no longer exists; cleared.');
      return;
    }
    const questionMap = new Map(bank.questions.map((item) => [item.id, item]));
    const questions = state.questionIds.map((id) => questionMap.get(id)).filter((item): item is Question => Boolean(item));
    if (questions.length === 0) {
      await clearActiveSession();
      refresh();
      return;
    }
    setQuiz({
      bank,
      questions,
      index: Math.min(state.index, questions.length - 1),
      selected: state.selected,
      marked: state.marked,
      optionOrderByQuestion: state.optionOrderByQuestion,
      sessionId: state.sessionId,
      createdAt: state.createdAt,
      showAllQuestions: state.showAllQuestions,
      mode: state.mode
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const importBankFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let imported = 0;
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseJsonFile(file);
        const result = validateQuizBank(parsed);
        if (!result.ok) {
          notify(`Import failed: ${result.errors.slice(0, 2).join('; ')}`);
          continue;
        }
        const exists = await db.banks.get(result.bank.bankId);
        if (exists && !window.confirm(`Replace existing bank "${exists.title}"?`)) {
          continue;
        }
        await db.banks.put(result.bank);
        imported += 1;
      } catch (error) {
        notify(`Import failed: ${error instanceof Error ? error.message : 'invalid JSON'}`);
      }
    }
    refresh();
    if (imported) notify(`Imported ${imported} question bank${imported === 1 ? '' : 's'}.`);
  };

  const importBackupFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseJsonFile(file);
      if (!isAppBackup(parsed)) {
        notify('Backup import failed: unsupported backup file.');
        return;
      }
      const invalidBank = parsed.banks.find((bank) => !validateQuizBank(bank).ok);
      if (invalidBank) {
        notify(`Backup import failed: bank "${invalidBank.title}" is invalid.`);
        return;
      }
      if (!window.confirm('Restore this backup and replace all current app data?')) return;
      await restoreBackup(parsed as AppBackup);
      setQuiz(null);
      refresh();
      notify('App data restored.');
    } catch (error) {
      notify(`Backup import failed: ${error instanceof Error ? error.message : 'invalid JSON'}`);
    }
  };

  const exportAll = async () => {
    downloadJson(`quiz-helper-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup());
  };

  const removeSelectedBank = async (bank: QuizBank) => {
    if (!window.confirm(`Remove "${bank.title}" and its progress?`)) return;
    await removeBank(bank.bankId);
    setSelectedBankId('');
    refresh();
    notify('Question bank removed.');
  };

  const resetBankProgress = async (bank: QuizBank) => {
    if (!window.confirm(`Reset progress for "${bank.title}"? Every question will become unanswered.`)) return;
    await db.progress.where('bankId').equals(bank.bankId).delete();
    refresh();
    notify('Progress reset.');
  };

  const saveSettings = async (settings: Partial<typeof defaultSettings>) => {
    await db.settings.put({ ...defaultSettings, ...data.settings, ...settings });
    refresh();
  };

  if (loading) {
    return <main className="shell loading">Loading question banks...</main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local question bank practice</p>
          <h1>Quiz Helper</h1>
        </div>
        <nav className="tabs" aria-label="Main navigation">
          <button className={view === 'banks' ? 'active' : ''} onClick={() => setView('banks')}><Database size={18} /> Banks</button>
          <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')}><Play size={18} /> Practice</button>
          <button className={view === 'data' ? 'active' : ''} onClick={() => setView('data')}><Settings size={18} /> Data</button>
        </nav>
      </header>

      {message && <div className="toast">{message}</div>}

      {quiz ? (
        <QuizRunner quiz={quiz} setQuiz={setQuiz} refresh={refresh} progressByKey={progressByKey} />
      ) : (
        <>
          {view === 'banks' && (
            <BankDashboard
              banks={data.banks}
              progress={data.progress}
              selectedBank={selectedBank}
              setSelectedBankId={setSelectedBankId}
              openPractice={() => setView('practice')}
              openWrongReview={(bank) => setWrongReviewBank(bank)}
              importBankFiles={importBankFiles}
              removeSelectedBank={removeSelectedBank}
              resetBankProgress={resetBankProgress}
            />
          )}
          {view === 'practice' && selectedBank && (
            <PracticeBuilder
              bank={selectedBank}
              banks={data.banks}
              progressByKey={progressByKey}
              setSelectedBankId={setSelectedBankId}
              setQuiz={setQuiz}
              notify={notify}
              showAllQuestions={data.settings.showAllQuestions}
              preserveOptionOrder={data.settings.preserveOptionOrder}
              activeSession={data.activeSession}
              resumeSession={resumeSession}
            />
          )}
          {view === 'data' && (
            <DataTools
              exportAll={exportAll}
              importBackupFile={importBackupFile}
              importBankFiles={importBankFiles}
              preserveOptionOrder={data.settings.preserveOptionOrder}
              showAllQuestions={data.settings.showAllQuestions}
              saveSettings={saveSettings}
            />
          )}
        </>
      )}
      {wrongReviewBank && (
        <WrongQuestionsModal
          bank={wrongReviewBank}
          progressByKey={progressByKey}
          onClose={() => setWrongReviewBank(null)}
        />
      )}
    </main>
  );
}

function BankDashboard({
  banks,
  progress,
  selectedBank,
  setSelectedBankId,
  openPractice,
  openWrongReview,
  importBankFiles,
  removeSelectedBank,
  resetBankProgress
}: {
  banks: QuizBank[];
  progress: QuestionProgress[];
  selectedBank?: QuizBank;
  setSelectedBankId: (id: string) => void;
  openPractice: () => void;
  openWrongReview: (bank: QuizBank) => void;
  importBankFiles: (files: FileList | null) => Promise<void>;
  removeSelectedBank: (bank: QuizBank) => Promise<void>;
  resetBankProgress: (bank: QuizBank) => Promise<void>;
}) {
  return (
    <section className="grid two">
      <div className="panel">
        <div className="panel-title">
          <h2>Question Banks</h2>
          <label className="icon-button">
            <Upload size={18} />
            <span>Import</span>
            <input type="file" accept="application/json,.json" multiple onChange={(event) => void importBankFiles(event.target.files)} />
          </label>
        </div>
        <div className="bank-list">
          {banks.map((bank) => (
            <button key={bank.bankId} className={`bank-row ${selectedBank?.bankId === bank.bankId ? 'active' : ''}`} onClick={() => setSelectedBankId(bank.bankId)}>
              <strong>{bank.title}</strong>
              <span>{bank.questions.length} questions · {bank.subject ?? bank.locale}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedBank && (
        <div className="panel">
          <div className="panel-title">
            <h2>{selectedBank.title}</h2>
            <div className="actions">
              <button className="primary" onClick={openPractice}><Play size={18} /> Practice</button>
              <button className="icon-button" onClick={() => openWrongReview(selectedBank)}><X size={18} /> Wrong answers</button>
              <button className="icon-button" onClick={() => void resetBankProgress(selectedBank)}><RotateCcw size={18} /> Reset progress</button>
              <button className="icon-button" onClick={() => downloadJson(`${selectedBank.bankId}.json`, selectedBank)}><Download size={18} /> Export</button>
              <button className="icon-button danger" onClick={() => void removeSelectedBank(selectedBank)}><Trash2 size={18} /> Remove</button>
            </div>
          </div>
          <p className="muted">{selectedBank.description ?? 'No description provided.'}</p>
          <BankStats bank={selectedBank} progress={progress} />
        </div>
      )}
    </section>
  );
}

function BankStats({ bank, progress }: { bank: QuizBank; progress: QuestionProgress[] }) {
  const scoped = progress.filter((item) => item.bankId === bank.bankId);
  const counts = {
    correct: scoped.filter((item) => item.status === 'correct').length,
    wrong: scoped.filter((item) => item.status === 'wrong').length
  };
  const unanswered = bank.questions.length - counts.correct - counts.wrong;
  const byType = availableCounts(bank.questions);
  return (
    <div className="stats">
      <Metric label="Correct" value={counts.correct} tone="good" />
      <Metric label="Wrong" value={counts.wrong} tone="bad" />
      <Metric label="Unanswered" value={Math.max(0, unanswered)} />
      {questionTypes.map((type) => <Metric key={type} label={labels[type]} value={byType[type]} />)}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return <div className={`metric ${tone ?? ''}`}><strong>{value}</strong><span>{label}</span></div>;
}

function WrongQuestionsModal({
  bank,
  progressByKey,
  onClose
}: {
  bank: QuizBank;
  progressByKey: Map<string, QuestionProgress>;
  onClose: () => void;
}) {
  const wrongQuestions = bank.questions
    .map((question) => ({
      question,
      progress: progressByKey.get(progressKey(bank.bankId, question.id))
    }))
    .filter((item): item is { question: Question; progress: QuestionProgress } => item.progress?.status === 'wrong');

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="wrong-review-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Wrong answer review</p>
            <h2 id="wrong-review-title">{bank.title}</h2>
          </div>
          <button className="icon-button" aria-label="Close wrong answers" onClick={onClose}><X size={18} /></button>
        </div>
        {wrongQuestions.length === 0 ? (
          <div className="empty-state">
            <Check size={28} />
            <p>No wrongly answered questions in this bank.</p>
          </div>
        ) : (
          <div className="wrong-list">
            {wrongQuestions.map(({ question, progress }) => (
              <article className="wrong-item" key={question.id}>
                <p className="question-number">#{question.number} · {labels[question.type]} · {question.difficulty ?? 'unspecified'}</p>
                <h3><FormulaText text={question.prompt} /></h3>
                <div className="review-options">
                  {question.options.map((option) => {
                    const isUserAnswer = progress.latestSelectedOptionIds.includes(option.id);
                    const isCorrect = progress.latestCorrectOptionIds.includes(option.id);
                    return (
                      <div className={`review-option ${isCorrect ? 'correct' : ''} ${isUserAnswer && !isCorrect ? 'wrong' : ''} ${isUserAnswer ? 'selected' : ''}`} key={option.id}>
                        <span className="option-label">{option.label}</span>
                        <span><FormulaText text={option.text} /></span>
                      </div>
                    );
                  })}
                </div>
                <AnswerLine label="Your answer" ids={progress.latestSelectedOptionIds} question={question} tone="bad" />
                <AnswerLine label="Correct answer" ids={progress.latestCorrectOptionIds} question={question} tone="good" />
                {question.explanation && <p className="explanation"><FormulaText text={question.explanation} /></p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AnswerLine({
  label,
  ids,
  question,
  tone
}: {
  label: string;
  ids: string[];
  question: Question;
  tone: 'good' | 'bad';
}) {
  const options = ids.map((id) => question.options.find((item) => item.id === id));

  return (
    <p className={`answer-line ${tone}`}>
      <strong>{label}:</strong>{' '}
      {ids.length === 0 ? 'No answer' : options.map((option, index) => (
        <span key={`${option?.id ?? ids[index]}-${index}`}>
          {index > 0 ? '; ' : ''}
          {option ? <><span>{option.label}: </span><FormulaText text={option.text} /></> : ids[index]}
        </span>
      ))}
    </p>
  );
}

function AnswerSummary({ label, ids, question }: { label: string; ids: string[]; question: Question }) {
  const selectedOptions = question.options.filter((option) => ids.includes(option.id));

  return (
    <p>
      <strong>{label}:</strong>{' '}
      {selectedOptions.length === 0
        ? 'No answer'
        : selectedOptions.map((option, index) => (
          <span key={option.id}>
            {index > 0 ? '; ' : ''}
            <FormulaText text={option.text} />
          </span>
        ))}
    </p>
  );
}

function PracticeBuilder({
  bank,
  banks,
  progressByKey,
  setSelectedBankId,
  setQuiz,
  notify,
  showAllQuestions,
  preserveOptionOrder,
  activeSession,
  resumeSession
}: {
  bank: QuizBank;
  banks: QuizBank[];
  progressByKey: Map<string, QuestionProgress>;
  setSelectedBankId: (id: string) => void;
  setQuiz: (quiz: ActiveQuiz) => void;
  notify: (text: string) => void;
  showAllQuestions: boolean;
  preserveOptionOrder: boolean;
  activeSession?: ActiveSessionState;
  resumeSession: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<QuizFilters>(defaultFilters);
  const [counts, setCounts] = useState<TypeCounts>(emptyCounts);
  const [mode, setMode] = useState<QuizMode>('standard');
  const countsEdited = useRef(false);
  const pool = useMemo(() => buildQuestionPool(bank, progressByKey, filters), [bank, filters, progressByKey]);
  const available = availableCounts(pool);
  const totalRequested = questionTypes.reduce((sum, type) => sum + counts[type], 0);
  const canStart = totalRequested > 0 && questionTypes.every((type) => counts[type] <= available[type]);

  const sections = bank.sections ?? [];
  const tags = unique(bank.questions.flatMap((question) => question.tags ?? []));
  const chapters = unique(bank.questions.map((question) => question.source?.chapter).filter(Boolean));
  const origins = unique(bank.questions.map((question) => question.source?.origin).filter(Boolean));

  useEffect(() => {
    if (!countsEdited.current) {
      setCounts({ ...available });
    }
  }, [available.single_choice, available.multiple_choice, available.true_false]);

  const startQuiz = () => {
    if (!canStart) {
      notify('Adjust counts to match the available filtered questions.');
      return;
    }
    if (activeSession && !window.confirm('Discard the unfinished practice session and start a new one?')) {
      return;
    }
    const questions = pickRandomQuestions(pool, counts);
    setQuiz({
      bank,
      questions,
      index: 0,
      selected: {},
      marked: {},
      optionOrderByQuestion: buildOptionOrderByQuestion(questions, preserveOptionOrder),
      sessionId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      showAllQuestions,
      mode
    });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Build Practice Set</h2>
          <p className="muted">{pool.length} matching questions in the current pool</p>
        </div>
        <select value={bank.bankId} onChange={(event) => setSelectedBankId(event.target.value)}>
          {banks.map((item) => <option key={item.bankId} value={item.bankId}>{item.title}</option>)}
        </select>
      </div>

      <div className="builder">
        <div className="filter-block">
          <h3><Filter size={18} /> Filters</h3>
          <CheckboxGroup title="Status" values={statuses} labels={statusLabels} selected={filters.statuses} onChange={(statuses) => setFilters({ ...filters, statuses })} />
          <CheckboxGroup title="Difficulty" values={['easy', 'medium', 'hard', 'unspecified']} selected={filters.difficulties} onChange={(difficulties) => setFilters({ ...filters, difficulties })} />
          <CheckboxGroup title="Sections" values={sections.map((section) => section.id)} labels={Object.fromEntries(sections.map((section) => [section.id, section.title]))} selected={filters.sections} onChange={(sections) => setFilters({ ...filters, sections })} emptyMeansAll />
          <CheckboxGroup title="Tags" values={tags} selected={filters.tags} onChange={(tags) => setFilters({ ...filters, tags })} emptyMeansAll />
          <CheckboxGroup title="Chapters" values={chapters} selected={filters.chapters} onChange={(chapters) => setFilters({ ...filters, chapters })} emptyMeansAll />
          <CheckboxGroup title="Origins" values={origins} selected={filters.origins} onChange={(origins) => setFilters({ ...filters, origins })} emptyMeansAll />
        </div>

        <div className="count-block">
          <h3><Play size={18} /> Question Counts</h3>
          <fieldset className="check-group">
            <legend>Mode</legend>
            <div>
              <label><input type="radio" checked={mode === 'standard'} onChange={() => setMode('standard')} /><span>Standard (mark manually)</span></label>
              <label><input type="radio" checked={mode === 'instant'} onChange={() => setMode('instant')} /><span>Instant (reveal on answer)</span></label>
            </div>
          </fieldset>
          {questionTypes.map((type) => (
            <label className="count-row" key={type}>
              <span>{labels[type]}</span>
              <input type="number" min={0} max={available[type]} value={counts[type]} onChange={(event) => { countsEdited.current = true; setCounts({ ...counts, [type]: Number(event.target.value) }); }} />
              <small>{available[type]} available</small>
            </label>
          ))}
          <button className="secondary" onClick={() => { countsEdited.current = false; setCounts({ ...available }); }}><Check size={18} /> Max available</button>
          <div className="action-row">
            <button className="primary" disabled={!canStart} onClick={startQuiz}><Play size={18} /> Start</button>
            {activeSession && (
              <button className="primary btn-accent" onClick={() => void resumeSession()}><RotateCcw size={18} /> Continue</button>
            )}
          </div>
          <button className="secondary" onClick={() => { countsEdited.current = false; setFilters(defaultFilters()); }}><RotateCcw size={18} /> Reset</button>
        </div>
      </div>
    </section>
  );
}

function CheckboxGroup<T extends string>({
  title,
  values,
  labels,
  selected,
  onChange,
  emptyMeansAll
}: {
  title: string;
  values: T[];
  labels?: Partial<Record<T, string>>;
  selected: T[];
  onChange: (selected: T[]) => void;
  emptyMeansAll?: boolean;
}) {
  if (values.length === 0) return null;
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };
  return (
    <fieldset className="check-group">
      <legend>{title}{emptyMeansAll ? ' · all when empty' : ''}</legend>
      <div>
        {values.map((value) => (
          <label key={value}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)} />
            <span>{labels?.[value] ?? value}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const finishSession = async (quiz: ActiveQuiz, setQuiz: (quiz: ActiveQuiz | null) => void, refresh: () => void) => {
  const markedItems = Object.values(quiz.marked);
  await db.sessions.put({
    id: quiz.sessionId,
    bankId: quiz.bank.bankId,
    questionIds: quiz.questions.map((item) => item.id),
    createdAt: quiz.createdAt,
    completedAt: new Date().toISOString(),
    correctCount: markedItems.filter((item) => item.status === 'correct').length,
    wrongCount: markedItems.filter((item) => item.status === 'wrong').length
  });
  await clearActiveSession();
  refresh();
  setQuiz(null);
};

function QuizRunner({
  quiz,
  setQuiz,
  refresh,
  progressByKey
}: {
  quiz: ActiveQuiz;
  setQuiz: (quiz: ActiveQuiz | null) => void;
  refresh: () => void;
  progressByKey: Map<string, QuestionProgress>;
}) {
  if (quiz.mode === 'instant') {
    return quiz.showAllQuestions
      ? <InstantAllQuestionsQuiz quiz={quiz} setQuiz={setQuiz} refresh={refresh} progressByKey={progressByKey} />
      : <InstantQuizRunner quiz={quiz} setQuiz={setQuiz} refresh={refresh} progressByKey={progressByKey} />;
  }
  return quiz.showAllQuestions
    ? <AllQuestionsQuiz quiz={quiz} setQuiz={setQuiz} refresh={refresh} progressByKey={progressByKey} />
    : <StandardQuizRunner quiz={quiz} setQuiz={setQuiz} refresh={refresh} progressByKey={progressByKey} />;
}

function StandardQuizRunner({
  quiz,
  setQuiz,
  refresh,
  progressByKey
}: {
  quiz: ActiveQuiz;
  setQuiz: (quiz: ActiveQuiz | null) => void;
  refresh: () => void;
  progressByKey: Map<string, QuestionProgress>;
}) {
  const question = quiz.questions[quiz.index];
  const selected = quiz.selected[question.id] ?? [];
  const marked = quiz.marked[question.id];
  const options = useMemo(
    () => orderedOptions(question, quiz.optionOrderByQuestion[question.id]),
    [question, quiz.optionOrderByQuestion]
  );

  const setSelected = (optionId: string) => {
    if (marked) return;
    const next = question.type === 'multiple_choice'
      ? selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]
      : [optionId];
    setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: next } });
  };

  const mark = async () => {
    const nextProgress = markQuestion(quiz.bank.bankId, question, selected, progressByKey.get(progressKey(quiz.bank.bankId, question.id)));
    await db.progress.put(nextProgress);
    setQuiz({ ...quiz, marked: { ...quiz.marked, [question.id]: nextProgress } });
    refresh();
  };

  return (
    <section className="panel quiz-panel">
      <div className="quiz-header">
        <button className="icon-button" onClick={() => setQuiz(null)}><ArrowLeft size={18} /> Exit</button>
        <div>
          <strong>Question {quiz.index + 1} of {quiz.questions.length}</strong>
          <span>{labels[question.type]} · {question.difficulty ?? 'unspecified'}</span>
        </div>
      </div>
      <article className="question-card">
        <p className="question-number">#{question.number}</p>
        <h2><FormulaText text={question.prompt} /></h2>
        {question.stem && <p className="stem"><FormulaText text={question.stem} /></p>}
        <div className="options">
          {options.map((option) => {
            const isSelected = selected.includes(option.id);
            const isCorrect = marked?.latestCorrectOptionIds.includes(option.id);
            const isWrongSelection = marked && isSelected && !isCorrect;
            return (
              <label key={option.id} className={`option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongSelection ? 'wrong' : ''}`}>
                <input type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'} name={question.id} checked={isSelected} onChange={() => setSelected(option.id)} />
                <span><FormulaText text={option.text} /></span>
              </label>
            );
          })}
        </div>
        {marked && (
          <div className={`result ${marked.status}`}>
            <strong>{marked.status === 'correct' ? 'Correct' : 'Wrong'}</strong>
            <AnswerSummary label="Your answer" ids={marked.latestSelectedOptionIds} question={question} />
            <AnswerSummary label="Correct answer" ids={marked.latestCorrectOptionIds} question={question} />
            {question.explanation && <p><FormulaText text={question.explanation} /></p>}
          </div>
        )}
      </article>
      <div className="quiz-actions">
        <button className="secondary" disabled={quiz.index === 0} onClick={() => setQuiz({ ...quiz, index: quiz.index - 1 })}>Previous</button>
        <button className="primary" disabled={selected.length === 0 || Boolean(marked)} onClick={() => void mark()}><Check size={18} /> Mark</button>
        {quiz.index < quiz.questions.length - 1 ? (
          <button className="secondary" onClick={() => setQuiz({ ...quiz, index: quiz.index + 1 })}>Next</button>
        ) : (
          <button className="primary" onClick={() => void finishSession(quiz, setQuiz, refresh)}>Finish</button>
        )}
      </div>
    </section>
  );
}

function InstantQuizRunner({
  quiz,
  setQuiz,
  refresh,
  progressByKey
}: {
  quiz: ActiveQuiz;
  setQuiz: (quiz: ActiveQuiz | null) => void;
  refresh: () => void;
  progressByKey: Map<string, QuestionProgress>;
}) {
  const question = quiz.questions[quiz.index];
  const selected = quiz.selected[question.id] ?? [];
  const marked = quiz.marked[question.id];
  const isMultiple = question.type === 'multiple_choice';
  const options = useMemo(
    () => orderedOptions(question, quiz.optionOrderByQuestion[question.id]),
    [question, quiz.optionOrderByQuestion]
  );

  const markNow = async (selectedIds: string[]) => {
    const nextProgress = markQuestion(quiz.bank.bankId, question, selectedIds, progressByKey.get(progressKey(quiz.bank.bankId, question.id)));
    await db.progress.put(nextProgress);
    setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: selectedIds }, marked: { ...quiz.marked, [question.id]: nextProgress } });
    refresh();
  };

  const setSelected = (optionId: string) => {
    if (marked) return;
    if (isMultiple) {
      const next = selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
      setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: next } });
    } else {
      void markNow([optionId]);
    }
  };

  const submitMultiple = () => {
    if (marked || selected.length === 0) return;
    void markNow(selected);
  };

  return (
    <section className="panel quiz-panel">
      <div className="quiz-header">
        <button className="icon-button" onClick={() => setQuiz(null)}><ArrowLeft size={18} /> Exit</button>
        <div>
          <strong>Question {quiz.index + 1} of {quiz.questions.length}</strong>
          <span>{labels[question.type]} · {question.difficulty ?? 'unspecified'} · Instant</span>
        </div>
      </div>
      <article className="question-card">
        <p className="question-number">#{question.number}</p>
        <h2><FormulaText text={question.prompt} /></h2>
        {question.stem && <p className="stem"><FormulaText text={question.stem} /></p>}
        <div className="options">
          {options.map((option) => {
            const isSelected = selected.includes(option.id);
            const isCorrect = marked?.latestCorrectOptionIds.includes(option.id);
            const isWrongSelection = marked && isSelected && !isCorrect;
            return (
              <label key={option.id} className={`option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongSelection ? 'wrong' : ''}`}>
                <input type={isMultiple ? 'checkbox' : 'radio'} name={question.id} checked={isSelected} onChange={() => setSelected(option.id)} disabled={Boolean(marked)} />
                <span><FormulaText text={option.text} /></span>
              </label>
            );
          })}
        </div>
        {marked && (
          <div className={`result ${marked.status}`}>
            <strong>{marked.status === 'correct' ? 'Correct' : 'Wrong'}</strong>
            <AnswerSummary label="Your answer" ids={marked.latestSelectedOptionIds} question={question} />
            <AnswerSummary label="Correct answer" ids={marked.latestCorrectOptionIds} question={question} />
            {question.explanation && <p><FormulaText text={question.explanation} /></p>}
          </div>
        )}
      </article>
      <div className="quiz-actions">
        <button className="secondary" disabled={quiz.index === 0} onClick={() => setQuiz({ ...quiz, index: quiz.index - 1 })}>Previous</button>
        {isMultiple && !marked && (
          <button className="primary" disabled={selected.length === 0} onClick={submitMultiple}><Check size={18} /> Submit</button>
        )}
        {quiz.index < quiz.questions.length - 1 ? (
          <button className="secondary" disabled={!marked} onClick={() => setQuiz({ ...quiz, index: quiz.index + 1 })}>Next</button>
        ) : (
          <button className="primary" disabled={!marked} onClick={() => void finishSession(quiz, setQuiz, refresh)}>Finish</button>
        )}
      </div>
    </section>
  );
}

function InstantAllQuestionsQuiz({
  quiz,
  setQuiz,
  refresh,
  progressByKey
}: {
  quiz: ActiveQuiz;
  setQuiz: (quiz: ActiveQuiz | null) => void;
  refresh: () => void;
  progressByKey: Map<string, QuestionProgress>;
}) {
  const allMarked = quiz.questions.every((question) => Boolean(quiz.marked[question.id]));

  const markOne = async (question: Question, selectedIds: string[]) => {
    const nextProgress = markQuestion(quiz.bank.bankId, question, selectedIds, progressByKey.get(progressKey(quiz.bank.bankId, question.id)));
    await db.progress.put(nextProgress);
    setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: selectedIds }, marked: { ...quiz.marked, [question.id]: nextProgress } });
    refresh();
  };

  const setSelected = (question: Question, optionId: string) => {
    if (quiz.marked[question.id]) return;
    const current = quiz.selected[question.id] ?? [];
    if (question.type === 'multiple_choice') {
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: next } });
    } else {
      void markOne(question, [optionId]);
    }
  };

  const submitMultiple = (question: Question) => {
    if (quiz.marked[question.id]) return;
    const current = quiz.selected[question.id] ?? [];
    if (current.length === 0) return;
    void markOne(question, current);
  };

  return (
    <section className="panel quiz-panel all-questions">
      <div className="quiz-header">
        <button className="icon-button" onClick={() => setQuiz(null)}><ArrowLeft size={18} /> Exit</button>
        <div>
          <strong>{quiz.questions.length} questions</strong>
          <span>Instant mode</span>
        </div>
      </div>
      <div className="question-stack">
        {quiz.questions.map((question, questionIndex) => {
          const selected = quiz.selected[question.id] ?? [];
          const marked = quiz.marked[question.id];
          const options = orderedOptions(question, quiz.optionOrderByQuestion[question.id]);
          const isMultiple = question.type === 'multiple_choice';
          return (
            <article className="question-card stacked" key={question.id}>
              <p className="question-number">Question {questionIndex + 1} · #{question.number} · {labels[question.type]} · {question.difficulty ?? 'unspecified'}</p>
              <h2><FormulaText text={question.prompt} /></h2>
              {question.stem && <p className="stem"><FormulaText text={question.stem} /></p>}
              <div className="options">
                {options.map((option) => {
                  const isSelected = selected.includes(option.id);
                  const isCorrect = marked?.latestCorrectOptionIds.includes(option.id);
                  const isWrongSelection = marked && isSelected && !isCorrect;
                  return (
                    <label key={option.id} className={`option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongSelection ? 'wrong' : ''}`}>
                      <input type={isMultiple ? 'checkbox' : 'radio'} name={question.id} checked={isSelected} onChange={() => setSelected(question, option.id)} disabled={Boolean(marked)} />
                      <span><FormulaText text={option.text} /></span>
                    </label>
                  );
                })}
              </div>
              {isMultiple && !marked && (
                <button className="primary" disabled={selected.length === 0} onClick={() => submitMultiple(question)}><Check size={18} /> Submit</button>
              )}
              {marked && (
                <div className={`result ${marked.status}`}>
                  <strong>{marked.status === 'correct' ? 'Correct' : 'Wrong'}</strong>
                  <AnswerSummary label="Your answer" ids={marked.latestSelectedOptionIds} question={question} />
                  <AnswerSummary label="Correct answer" ids={marked.latestCorrectOptionIds} question={question} />
                  {question.explanation && <p><FormulaText text={question.explanation} /></p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="quiz-actions">
        <button className="primary" disabled={!allMarked} onClick={() => void finishSession(quiz, setQuiz, refresh)}>Finish</button>
      </div>
    </section>
  );
}

function AllQuestionsQuiz({
  quiz,
  setQuiz,
  refresh,
  progressByKey
}: {
  quiz: ActiveQuiz;
  setQuiz: (quiz: ActiveQuiz | null) => void;
  refresh: () => void;
  progressByKey: Map<string, QuestionProgress>;
}) {
  const allAnswered = quiz.questions.every((question) => (quiz.selected[question.id] ?? []).length > 0);
  const allMarked = quiz.questions.every((question) => Boolean(quiz.marked[question.id]));

  const setSelected = (question: Question, optionId: string) => {
    if (allMarked) return;
    const current = quiz.selected[question.id] ?? [];
    const next = question.type === 'multiple_choice'
      ? current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
      : [optionId];
    setQuiz({ ...quiz, selected: { ...quiz.selected, [question.id]: next } });
  };

  const markAll = async () => {
    const nextMarked: Record<string, QuestionProgress> = {};
    for (const question of quiz.questions) {
      nextMarked[question.id] = markQuestion(
        quiz.bank.bankId,
        question,
        quiz.selected[question.id] ?? [],
        progressByKey.get(progressKey(quiz.bank.bankId, question.id))
      );
    }
    await db.progress.bulkPut(Object.values(nextMarked));
    setQuiz({ ...quiz, marked: nextMarked });
    refresh();
  };

  return (
    <section className="panel quiz-panel all-questions">
      <div className="quiz-header">
        <button className="icon-button" onClick={() => setQuiz(null)}><ArrowLeft size={18} /> Exit</button>
        <div>
          <strong>{quiz.questions.length} questions</strong>
          <span>Single choice, multiple choice, then true/false</span>
        </div>
      </div>
      <div className="question-stack">
        {quiz.questions.map((question, questionIndex) => {
          const selected = quiz.selected[question.id] ?? [];
          const marked = quiz.marked[question.id];
          const options = orderedOptions(question, quiz.optionOrderByQuestion[question.id]);
          return (
            <article className="question-card stacked" key={question.id}>
              <p className="question-number">Question {questionIndex + 1} · #{question.number} · {labels[question.type]} · {question.difficulty ?? 'unspecified'}</p>
              <h2><FormulaText text={question.prompt} /></h2>
              {question.stem && <p className="stem"><FormulaText text={question.stem} /></p>}
              <div className="options">
                {options.map((option) => {
                  const isSelected = selected.includes(option.id);
                  const isCorrect = marked?.latestCorrectOptionIds.includes(option.id);
                  const isWrongSelection = marked && isSelected && !isCorrect;
                  return (
                    <label key={option.id} className={`option ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongSelection ? 'wrong' : ''}`}>
                      <input type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'} name={question.id} checked={isSelected} onChange={() => setSelected(question, option.id)} />
                      <span><FormulaText text={option.text} /></span>
                    </label>
                  );
                })}
              </div>
              {marked && (
                <div className={`result ${marked.status}`}>
                  <strong>{marked.status === 'correct' ? 'Correct' : 'Wrong'}</strong>
                  <AnswerSummary label="Your answer" ids={marked.latestSelectedOptionIds} question={question} />
                  <AnswerSummary label="Correct answer" ids={marked.latestCorrectOptionIds} question={question} />
                  {question.explanation && <p><FormulaText text={question.explanation} /></p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="quiz-actions">
        <button className="primary" disabled={!allAnswered || allMarked} onClick={() => void markAll()}><Check size={18} /> Mark all</button>
        <button className="primary" disabled={!allMarked} onClick={() => void finishSession(quiz, setQuiz, refresh)}>Finish</button>
      </div>
    </section>
  );
}

function DataTools({
  exportAll,
  importBackupFile,
  importBankFiles,
  preserveOptionOrder,
  showAllQuestions,
  saveSettings
}: {
  exportAll: () => Promise<void>;
  importBackupFile: (file: File | undefined) => Promise<void>;
  importBankFiles: (files: FileList | null) => Promise<void>;
  preserveOptionOrder: boolean;
  showAllQuestions: boolean;
  saveSettings: (settings: Partial<{ preserveOptionOrder: boolean; showAllQuestions: boolean }>) => Promise<void>;
}) {
  const copySkillInstallCommand = async () => {
    await navigator.clipboard.writeText(skillInstallCommand);
  };

  return (
    <section className="grid two">
      <div className="panel">
        <h2>Import and Export</h2>
        <div className="tool-list">
          <button className="primary" onClick={() => void exportAll()}><Download size={18} /> Export app data</button>
          <label className="icon-button full">
            <FileJson size={18} />
            <span>Restore app backup</span>
            <input type="file" accept="application/json,.json" onChange={(event) => void importBackupFile(event.target.files?.[0])} />
          </label>
          <label className="icon-button full">
            <Upload size={18} />
            <span>Import question banks</span>
            <input type="file" accept="application/json,.json" multiple onChange={(event) => void importBankFiles(event.target.files)} />
          </label>
        </div>
      </div>
      <div className="panel">
        <h2>Practice Settings</h2>
        <label className="switch-row">
          <input type="checkbox" checked={showAllQuestions} onChange={(event) => void saveSettings({ showAllQuestions: event.target.checked })} />
          <span>Show all picked questions at once</span>
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={preserveOptionOrder} onChange={(event) => void saveSettings({ preserveOptionOrder: event.target.checked })} />
          <span>Preserve option order</span>
        </label>
      </div>
      <div className="panel install-panel">
        <div className="panel-title compact">
          <div>
            <h2>Question Bank Skill</h2>
            <p className="muted">Install the bundled Codex skill from this repository.</p>
          </div>
          <Terminal size={22} />
        </div>
        <div className="command-row">
          <code>{skillInstallCommand}</code>
          <button className="icon-button" onClick={() => void copySkillInstallCommand()}><Clipboard size={18} /> Copy</button>
        </div>
      </div>
    </section>
  );
}

const unique = <T extends string>(items: Array<T | undefined>) =>
  [...new Set(items.filter((item): item is T => Boolean(item)))].sort((a, b) => a.localeCompare(b));

export default App;
