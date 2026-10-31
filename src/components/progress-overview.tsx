"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  QuizIcon,
  SparklesIcon,
  VideoIcon,
} from "@/components/icons";
import {
  ApiError,
  getProgress,
  type ActivityItem,
  type ProgressResponse,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

const activityStyles: Record<
  ActivityItem["type"],
  { icon: typeof BookOpenIcon; className: string }
> = {
  lesson_uploaded: {
    icon: FileTextIcon,
    className: "bg-slate-100 text-slate-600",
  },
  study_notes: {
    icon: BookOpenIcon,
    className: "bg-slate-100 text-slate-600",
  },
  quiz_completed: {
    icon: QuizIcon,
    className: "bg-slate-100 text-slate-600",
  },
};

export function ProgressOverview() {
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getProgress();
        if (!cancelled) {
          setProgress(result);
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
  }, []);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="bg-white p-4 sm:p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-7 w-12 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
            Loading your learning progress…
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !progress) {
    return (
      <div className="card p-5">
        <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Progress could not be loaded
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Study materials",
      value: progress.total_lessons.toString(),
      hint: "PDFs processed",
      icon: FileTextIcon,
    },
    {
      label: "Quizzes completed",
      value: progress.quizzes_completed.toString(),
      hint: "Graded exam attempts",
      icon: QuizIcon,
    },
    {
      label: "Average score",
      value:
        progress.quizzes_completed > 0
          ? `${Math.round(progress.average_quiz_score)}%`
          : "—",
      hint:
        progress.quizzes_completed > 0
          ? "Across all attempts"
          : "Complete a quiz to see",
      icon: CheckCircleIcon,
    },
    {
      label: "Videos generated",
      value: progress.videos_generated.toString(),
      hint: "Narrated MP4 lessons",
      icon: VideoIcon,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className="bg-white p-4 sm:p-5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{stat.hint}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div>
              <h2 className="section-title">
                Weak topics
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Topics with incorrect answers across your attempts.
              </p>
            </div>
            <span className="badge bg-amber-50 text-amber-700">
              {progress.weak_topics.length}
            </span>
          </div>

          {progress.weak_topics.length === 0 ? (
            <div className="p-5">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-emerald-700">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {progress.quizzes_completed === 0
                  ? "Complete a quiz to start tracking weak topics."
                  : "No weak topics detected yet. Keep it up!"}
              </p>
              <Link
                href="/quiz"
                className="link mt-3 text-xs"
              >
                Take a quiz
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {progress.weak_topics.slice(0, 5).map((topic) => (
                <li
                  key={topic.topic}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {topic.topic}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {topic.correct} of {topic.total} correct
                    </p>
                  </div>
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-amber-400"
                        style={{
                          width: `${Math.max(0, Math.min(100, topic.accuracy))}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] font-medium text-slate-500">
                      {Math.round(topic.accuracy)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div>
              <h2 className="section-title">
                Recent activity
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Your latest uploads, notes, and quiz attempts.
              </p>
            </div>
            <ClockIcon className="h-4 w-4 text-slate-400" />
          </div>

          {progress.recent_activity.length === 0 ? (
            <div className="p-5 text-center">
              <SparklesIcon className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                No activity yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Upload a PDF to start building your learning history.
              </p>
              <Link href="/create" className="btn-primary mt-3 px-3 py-2 text-xs">
                Upload a PDF
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {progress.recent_activity.slice(0, 5).map((item, index) => {
                const style = activityStyles[item.type];
                const Icon = style.icon;

                return (
                  <li key={`${item.type}-${item.created_at}-${index}`}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.className}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {item.detail}
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-[10px] text-slate-400">
                        {formatDate(item.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
