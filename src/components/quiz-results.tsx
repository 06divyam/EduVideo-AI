"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  QuizIcon,
  SparklesIcon,
  XCircleIcon,
} from "@/components/icons";
import { ApiError, getAttempt, type AttemptResult } from "@/lib/api";
import { formatDate } from "@/lib/format";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

const optionLabels = ["A", "B", "C", "D"];

export function QuizResults({ attemptId }: { attemptId: string }) {
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getAttempt(attemptId);
        if (!cancelled) {
          setAttempt(result);
          setState("ready");
        }
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
  }, [attemptId]);

  if (state === "loading") {
    return (
      <section className="card p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          Loading your results…
        </div>
      </section>
    );
  }

  if (state === "error" || !attempt) {
    return (
      <section className="card p-6">
        <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Results could not be loaded
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {loadError ?? "This attempt could not be found."}
            </p>
            <Link href="/quiz" className="btn-secondary mt-3 px-3 py-2 text-xs">
              Back to quizzes
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const correctCount = attempt.questions.filter(
    (question) => question.is_correct,
  ).length;
  const needsReview = attempt.questions.length - correctCount;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-xs font-medium text-slate-500">
              Exam score
            </p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
              {attempt.percentage}%
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {attempt.score} of {attempt.total} correct
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-slate-100 text-slate-700">
                {attempt.quiz_title}
              </span>
              <span className="badge bg-slate-100 text-slate-600">
                {formatDate(attempt.completed_at)}
              </span>
            </div>

            <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">
              {attempt.percentage >= 80
                ? "Excellent work."
                : attempt.percentage >= 60
                  ? "Solid attempt — keep refining."
                  : "Let’s review and try again."}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {needsReview === 0
                ? "You answered every question correctly. Review the explanations below to lock in the lesson."
                : `${needsReview} ${
                    needsReview === 1 ? "question needs" : "questions need"
                  } review. Check the explanations and your weak topics below.`}
            </p>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                  Correct
                </dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {correctCount}
                </dd>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <XCircleIcon className="h-3.5 w-3.5 text-rose-500" />
                  Needs review
                </dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {needsReview}
                </dd>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                  Time used
                </dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {formatDuration(attempt.duration_seconds)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/quiz/${attempt.quiz_id}`} className="btn-primary">
                <QuizIcon className="h-4 w-4" />
                Retake exam
              </Link>
              <Link href="/quiz" className="btn-secondary">
                <SparklesIcon className="h-4 w-4" />
                New quiz
              </Link>
              <Link href="/study" className="btn-ghost">
                <BookOpenIcon className="h-4 w-4" />
                Review notes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Answer review
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Every question includes the correct answer and an explanation.
              </p>
            </div>
          </div>

          {attempt.questions.map((question, index) => (
            <article key={question.question_id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    question.is_correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="badge bg-slate-100 capitalize text-slate-600">
                  {question.difficulty}
                </span>
                <span className="badge bg-slate-100 text-slate-700">
                  {question.topic}
                </span>
                <span
                  className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold ${
                    question.is_correct ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {question.is_correct ? (
                    <>
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Correct
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-3.5 w-3.5" />
                      Incorrect
                    </>
                  )}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900">
                {question.question}
              </h3>

              <ul className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.correct_index;
                  const isSelected = optionIndex === question.selected_index;

                  return (
                    <li
                      key={`${question.question_id}-${optionIndex}`}
                      className={`flex items-start gap-2.5 rounded-md border p-3 text-xs leading-relaxed ${
                        isCorrect
                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                          : isSelected
                            ? "border-rose-200 bg-rose-50/70 text-rose-900"
                            : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${
                          isCorrect
                            ? "bg-emerald-600 text-white"
                            : isSelected
                              ? "bg-rose-600 text-white"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {optionLabels[optionIndex]}
                      </span>
                      <span className="pt-0.5">{option}</span>
                      {isCorrect ? (
                        <span className="ml-auto shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                          Correct
                        </span>
                      ) : isSelected ? (
                        <span className="ml-auto shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                          Your answer
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 rounded-md bg-slate-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <SparklesIcon className="h-3 w-3" />
                  Explanation
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {question.explanation}
                </p>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Weak topics</h2>
            {attempt.weak_topics.length === 0 ? (
              <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-emerald-700">
                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No weak topics detected in this attempt.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attempt.weak_topics.map((topic) => (
                  <li
                    key={topic.topic}
                    className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  >
                    <span className="font-medium">{topic.topic}</span>
                    <span className="shrink-0 text-[11px] text-amber-700">
                      {topic.correct}/{topic.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Topic performance
            </h2>
            <ul className="mt-3 space-y-3">
              {attempt.topic_performance.map((topic) => (
                <li key={topic.topic}>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium text-slate-700">
                      {topic.topic}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {Math.round(topic.accuracy)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full ${
                        topic.accuracy >= 80
                          ? "bg-emerald-500"
                          : topic.accuracy >= 50
                            ? "bg-amber-400"
                            : "bg-rose-400"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, topic.accuracy))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Keep going
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Review the lesson notes, then retake the exam to improve your weak
              topics.
            </p>
            <Link
              href="/study"
              className="link mt-3 text-xs"
            >
              Open study notes
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
