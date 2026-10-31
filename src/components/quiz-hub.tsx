"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ClockIcon,
  FileTextIcon,
  QuizIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  ApiError,
  generateQuiz,
  listDocuments,
  listQuizzes,
  type DocumentListItem,
  type QuizDifficultyPreference,
  type QuizListItem,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

const difficultyOptions: {
  value: QuizDifficultyPreference;
  label: string;
  description: string;
}[] = [
  { value: "mixed", label: "Mixed", description: "Balanced difficulty" },
  { value: "easy", label: "Easy", description: "Warm-up questions" },
  { value: "medium", label: "Medium", description: "Standard exam level" },
  { value: "hard", label: "Hard", description: "Deeper application" },
];

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export function QuizHub() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] =
    useState<QuizDifficultyPreference>("mixed");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Bumped by the retry button to re-run the workspace requests.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const [documentsResult, quizzesResult] = await Promise.all([
          listDocuments(),
          listQuizzes(),
        ]);
        if (cancelled) {
          return;
        }
        const loaded = documentsResult.documents;
        // Preselect ?document=<id> when it matches, otherwise the newest PDF.
        const requested = new URLSearchParams(window.location.search).get(
          "document",
        );
        const defaultId =
          loaded.find((document) => document.document_id === requested)
            ?.document_id ??
          loaded[0]?.document_id ??
          null;

        setDocuments(loaded);
        setQuizzes(quizzesResult.quizzes);
        setSelectedDocumentId((current) => current ?? defaultId);
        setState("ready");
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setLoadError(errorMessage(error));
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retryLoad() {
    setState("loading");
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  async function handleGenerate() {
    if (!selectedDocumentId) {
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const quiz = await generateQuiz({
        documentId: selectedDocumentId,
        questionCount,
        difficulty,
      });
      router.push(`/quiz/${quiz.quiz_id}`);
    } catch (error) {
      setGenerateError(errorMessage(error));
      setGenerating(false);
    }
  }

  if (state === "loading") {
    return (
      <section className="card p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          Loading quizzes and lessons…
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="card p-6">
        <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Could not load the quiz workspace
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {loadError}
            </p>
            <button
              type="button"
              onClick={retryLoad}
              className="btn-secondary mt-3 px-3 py-2 text-xs"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  const selectedDocument = documents.find(
    (document) => document.document_id === selectedDocumentId,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Create an exam
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Gemini writes questions using only the selected PDF. Answers stay
                hidden until you submit.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <BookOpenIcon className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Upload a PDF first
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Quizzes are generated from your uploaded study material. Add a
                PDF to get started.
              </p>
              <Link href="/create" className="btn-primary mt-4">
                <FileTextIcon className="h-4 w-4" />
                Upload a PDF
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <label htmlFor="quiz-document" className="label">
                  Study material
                </label>
                <div className="relative mt-2">
                  <select
                    id="quiz-document"
                    value={selectedDocumentId ?? ""}
                    onChange={(event) =>
                      setSelectedDocumentId(event.target.value)
                    }
                    className="input appearance-none pr-9"
                  >
                    {documents.map((document) => (
                      <option
                        key={document.document_id}
                        value={document.document_id}
                      >
                        {document.filename}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                {selectedDocument ? (
                  <p className="hint mt-1.5">
                    {selectedDocument.page_count}{" "}
                    {selectedDocument.page_count === 1 ? "page" : "pages"} ·{" "}
                    {selectedDocument.text_length.toLocaleString()} characters
                    extracted
                  </p>
                ) : null}
              </div>

              <fieldset className="mt-5">
                <legend className="label">Number of questions</legend>
                <p className="hint mt-1">Choose between 5 and 10 MCQs.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 6, 7, 8, 9, 10].map((count) => (
                    <label
                      key={count}
                      className="option px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      <input
                        type="radio"
                        name="question-count"
                        value={count}
                        checked={questionCount === count}
                        onChange={() => setQuestionCount(count)}
                        className="sr-only"
                      />
                      {count}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-5">
                <legend className="label">Difficulty</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {difficultyOptions.map((option) => (
                    <label
                      key={option.value}
                      className="option p-3"
                    >
                      <input
                        type="radio"
                        name="quiz-difficulty"
                        value={option.value}
                        checked={difficulty === option.value}
                        onChange={() => setDifficulty(option.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-slate-900">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ClockIcon className="h-3.5 w-3.5" />
                  Timed exam · {questionCount * 60} seconds
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || !selectedDocumentId}
                  className="btn-primary shrink-0"
                >
                  {generating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Generating quiz…
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Generate Quiz
                    </>
                  )}
                </button>
              </div>

              {generateError ? (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3.5"
                >
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-sm font-semibold text-rose-900">
                      Quiz could not be generated
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-rose-800">
                      {generateError}
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent quizzes
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Resume an exam or review previous attempts.
              </p>
            </div>
            <span className="badge bg-slate-100 text-slate-500">
              {quizzes.length}
            </span>
          </div>

          {quizzes.length === 0 ? (
            <div className="p-6 text-center">
              <QuizIcon className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                No quizzes yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Generate your first quiz from a lesson above.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {quizzes.map((quiz) => (
                <li
                  key={quiz.quiz_id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {quiz.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {quiz.document_filename} · {quiz.question_count} questions ·{" "}
                      {Math.round(quiz.time_limit_seconds / 60)} min
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDate(quiz.created_at)} ·{" "}
                      {quiz.attempt_count}{" "}
                      {quiz.attempt_count === 1 ? "attempt" : "attempts"}
                    </p>
                  </div>
                  <Link
                    href={`/quiz/${quiz.quiz_id}`}
                    className="btn-secondary shrink-0 px-3 py-2 text-xs"
                  >
                    Start exam
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Exam rules</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              Answers are hidden until you submit the exam.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              The timer submits automatically when it reaches zero.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              Every question includes an explanation after submission.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              Weak topics are tracked from your incorrect answers.
            </li>
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Need notes first?
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Generate topic-wise study notes before attempting the exam.
          </p>
          <Link
            href="/study"
            className="link mt-3 text-xs"
          >
            Open study notes
          </Link>
        </section>
      </aside>
    </div>
  );
}
