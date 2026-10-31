"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  QuizIcon,
  SparklesIcon,
} from "@/components/icons";
import {
  ApiError,
  getQuiz,
  submitQuizAttempt,
  type QuizPublic,
} from "@/lib/api";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

const optionLabels = ["A", "B", "C", "D"];

export function QuizRunner({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const answersRef = useRef<Record<string, number>>({});
  const remainingRef = useRef(0);
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getQuiz(quizId);
        if (cancelled) {
          return;
        }
        setQuiz(result);
        setRemaining(result.time_limit_seconds);
        setState("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadError(errorMessage(error));
          setState("error");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const submitAttempt = useCallback(
    async (autoSubmitted: boolean) => {
      if (submittingRef.current || submittedRef.current) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);

      const payload = Object.entries(answersRef.current).map(
        ([questionId, selectedIndex]) => ({
          question_id: questionId,
          selected_index: selectedIndex,
        }),
      );
      const duration = Math.max(
        0,
        (quiz?.time_limit_seconds ?? 0) - remainingRef.current,
      );

      try {
        const result = await submitQuizAttempt(quizId, payload, duration);
        submittedRef.current = true;
        router.push(`/quiz/${quizId}/results/${result.attempt_id}`);
      } catch (error) {
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitError(
          autoSubmitted
            ? `Time is up, but the exam could not be submitted. ${errorMessage(error)}`
            : errorMessage(error),
        );
      }
    },
    [quiz, quizId, router],
  );

  useEffect(() => {
    if (state !== "ready" || submittedRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          void submitAttempt(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state, submitAttempt]);

  if (state === "loading") {
    return (
      <section className="card p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
          Loading exam…
        </div>
      </section>
    );
  }

  if (state === "error" || !quiz) {
    return (
      <section className="card p-6">
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Exam could not be loaded
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {loadError ?? "The quiz could not be found."}
            </p>
            <Link href="/quiz" className="btn-secondary mt-3 px-3 py-2 text-xs">
              Back to quizzes
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const question = quiz.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const unanswered = quiz.questions.length - answeredCount;
  const isLast = currentIndex === quiz.questions.length - 1;
  const selectedIndex = answers[question.id];

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                <QuizIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-slate-900">
                  {quiz.title}
                </h1>
                <p className="text-xs text-slate-500">
                  {quiz.questions.length} questions · answers hidden until
                  submission
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
                remaining <= 60
                  ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                  : "bg-slate-100 text-slate-700"
              }`}
              aria-live="polite"
            >
              <ClockIcon className="h-4 w-4" />
              {formatTime(remaining)}
            </span>
            <button
              type="button"
              onClick={() => void submitAttempt(false)}
              disabled={submitting}
              className="btn-primary shrink-0"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit exam
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {answeredCount} of {quiz.questions.length} answered
            </span>
            <span>{Math.round((answeredCount / quiz.questions.length) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
              style={{
                width: `${(answeredCount / quiz.questions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-indigo-50 text-indigo-700">
              Question {currentIndex + 1} of {quiz.questions.length}
            </span>
            <span className="badge bg-slate-100 capitalize text-slate-600">
              {question.difficulty}
            </span>
            <span className="badge bg-violet-50 text-violet-700">
              {question.topic}
            </span>
          </div>

          <h2 className="mt-4 text-lg font-semibold leading-snug text-slate-900">
            {question.question}
          </h2>

          <div className="mt-5 space-y-2.5">
            {question.options.map((option, index) => {
              const selected = selectedIndex === index;

              return (
                <button
                  key={`${question.id}-${index}`}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: index,
                    }))
                  }
                  aria-pressed={selected}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    selected
                      ? "border-indigo-500 bg-indigo-50/80"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                      selected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {optionLabels[index]}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-slate-700">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              disabled={currentIndex === 0}
              className="btn-secondary px-3 py-2 text-xs"
            >
              <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
              Previous
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => void submitAttempt(false)}
                disabled={submitting}
                className="btn-primary px-3 py-2 text-xs"
              >
                Submit exam
                <CheckCircleIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.min(quiz.questions.length - 1, index + 1),
                  )
                }
                className="btn-primary px-3 py-2 text-xs"
              >
                Next question
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="card p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Question navigator
            </h2>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {quiz.questions.map((item, index) => {
                const answered = item.id in answers;
                const active = index === currentIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    aria-label={`Go to question ${index + 1}${
                      answered ? " (answered)" : ""
                    }`}
                    aria-current={active ? "true" : undefined}
                    className={`flex h-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-indigo-600 text-white"
                        : answered
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-slate-500">
              <p className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Answered
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Not answered
              </p>
            </div>
          </section>

          {unanswered > 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                {unanswered}{" "}
                {unanswered === 1 ? "question is" : "questions are"} still
                unanswered. You can submit anyway.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-[11px] leading-relaxed text-emerald-800">
                All questions answered. Review your choices before submitting.
              </p>
            </div>
          )}

          <section className="card p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <SparklesIcon className="h-3.5 w-3.5 text-indigo-500" />
              Answers hidden
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Correct answers, explanations, and your score appear after
              submission.
            </p>
          </section>

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[11px] leading-relaxed text-rose-800">
                {submitError}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
