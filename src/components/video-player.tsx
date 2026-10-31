"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  MicIcon,
  PlusCircleIcon,
  QuizIcon,
  SparklesIcon,
  VideoIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  ApiError,
  backendUrl,
  getVideo,
  isVideoActive,
  videoStageLabels,
  type VideoJob,
} from "@/lib/api";
import { formatDate, formatDuration, formatFileSize } from "@/lib/format";

const POLL_INTERVAL_MS = 2000;

const stages = [
  { key: "script", label: "Lesson script", icon: SparklesIcon },
  { key: "narration", label: "Narration", icon: MicIcon },
  { key: "slides", label: "Slides", icon: ImageIcon },
  { key: "assembling", label: "MP4 assembly", icon: VideoIcon },
] as const;

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  college: "College",
  exam: "Exam Preparation",
};

const styleLabels: Record<string, string> = {
  illustrated: "Illustrated Slides",
  classroom: "Classroom",
  minimal: "Minimal",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export function VideoPlayer({ videoId }: { videoId: string }) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch the job and keep polling while it is queued or processing.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const result = await getVideo(videoId);
        if (cancelled) {
          return;
        }
        setJob(result);
        setLoadError(null);
        if (isVideoActive(result)) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(errorMessage(error));
        // Keep trying through brief network hiccups while a job is running.
        if (!(error instanceof ApiError && error.status === 404)) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS * 2);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [videoId]);

  if (!job) {
    return loadError ? (
      <section className="card p-6">
        <div className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Video could not be loaded
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-800">
              {loadError}
            </p>
            <Link href="/videos" className="btn-secondary mt-3 px-3 py-2 text-xs">
              Back to My Videos
            </Link>
          </div>
        </div>
      </section>
    ) : (
      <section className="card p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          Loading video…
        </div>
      </section>
    );
  }

  const title = job.title ?? job.document_filename ?? "Untitled lesson";
  const videoSrc = backendUrl(job.video_url);
  const downloadHref = backendUrl(job.download_url);
  const posterSrc = backendUrl(job.thumbnail_url);
  const captionsSrc = backendUrl(job.captions_url);
  const activeStageIndex = stages.findIndex((stage) => stage.key === job.stage);
  const status = job.status === "ready" ? "ready" : job.status === "failed" ? "failed" : "processing";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card overflow-hidden">
          {job.status === "ready" && videoSrc ? (
            <video
              key={videoSrc}
              controls
              preload="metadata"
              poster={posterSrc}
              crossOrigin="anonymous"
              className="aspect-video w-full bg-slate-950"
            >
              <source src={videoSrc} type="video/mp4" />
              {captionsSrc ? (
                <track
                  kind="captions"
                  src={captionsSrc}
                  srcLang={job.language === "English" ? "en" : undefined}
                  label={`${job.language} captions`}
                  default
                />
              ) : null}
              Your browser cannot play this video. Use the download button instead.
            </video>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 border-b border-slate-200 bg-slate-50 p-6 text-center">
              {job.status === "failed" ? (
                <div role="alert" className="flex max-w-md flex-col items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                    <AlertTriangleIcon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Generation failed
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-700">
                    {job.error_message ?? "The video could not be generated."}
                  </p>
                </div>
              ) : (
                <div aria-live="polite" className="w-full max-w-sm">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {videoStageLabels[job.stage] ?? "Processing"}…
                    </p>
                    <p className="tabular-nums text-slate-500">{job.progress}%</p>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={job.progress}
                    aria-label="Video generation progress"
                  >
                    <div
                      className="h-1.5 rounded-full bg-brand-600 transition-[width] duration-500"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    You can leave this page; the video keeps generating.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                {job.subject ? (
                  <span className="text-xs text-slate-500">{job.subject}</span>
                ) : null}
              </div>
              <h2 className="mt-2 text-base font-semibold leading-snug text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Created {formatDate(job.created_at)}
                {job.duration_seconds
                  ? ` · ${formatDuration(Math.round(job.duration_seconds))}`
                  : ""}
                {job.size_bytes ? ` · ${formatFileSize(job.size_bytes)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {job.status === "ready" && downloadHref ? (
                <a href={downloadHref} download className="btn-primary">
                  <DownloadIcon className="h-4 w-4" />
                  Download MP4
                </a>
              ) : null}
              {job.status === "failed" ? (
                <Link href="/create" className="btn-primary">
                  <PlusCircleIcon className="h-4 w-4" />
                  Try again
                </Link>
              ) : null}
              <Link
                href={`/quiz?document=${encodeURIComponent(job.document_id)}`}
                className="btn-secondary"
              >
                <QuizIcon className="h-4 w-4" />
                Quiz on this PDF
              </Link>
            </div>
          </div>
        </section>

        {job.scenes.length > 0 ? (
          <section className="card p-5 sm:p-6">
            <h2 className="section-title">
              Lesson outline
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {job.scenes.length} scenes written by Gemini from{" "}
              {job.document_filename ?? "your PDF"}.
            </p>
            <ol className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {job.scenes.map((scene, index) => (
                <li key={`${index}-${scene.heading}`} className="py-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="mr-2 text-xs font-medium tabular-nums text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {scene.heading}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {scene.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card p-5">
          <h2 className="section-title">Progress</h2>
          <ol className="mt-3 space-y-2.5">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const done =
                job.status === "ready" ||
                (activeStageIndex > -1 && index < activeStageIndex);
              const active = isVideoActive(job) && index === activeStageIndex;

              return (
                <li key={stage.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      done
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : active
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {done ? (
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={
                      done || active ? "font-medium text-slate-900" : "text-slate-500"
                    }
                  >
                    {stage.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card p-5">
          <h2 className="section-title">Details</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            {[
              ["Source", job.document_filename ?? "PDF"],
              ["Level", levelLabels[job.level] ?? job.level],
              ["Language", job.language],
              ["Target length", `${job.duration_minutes} min`],
              ["Style", styleLabels[job.style] ?? job.style],
              ["Voice", job.voice],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">{label}</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium text-slate-900"
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-400">
          <FileTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Captions follow each scene exactly; timing within a scene is estimated
          from sentence length.
        </p>
      </aside>
    </div>
  );
}
