import Link from "next/link";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  PlayIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { formatDate, formatDuration } from "@/lib/format";
import type { Video } from "@/lib/types";

type VideoCardProps = {
  video: Video;
  showActions?: boolean;
};

export function VideoCard({ video, showActions = true }: VideoCardProps) {
  const canPlay = Boolean(video.videoUrl);
  const playHref = video.previewHref ?? video.videoUrl;
  const downloadHref = video.downloadUrl ?? video.videoUrl;
  const isInternal = Boolean(video.previewHref);

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <div className="relative">
        <VideoThumbnail video={video} />

        {video.isSample ? (
          <span className="absolute right-3 top-3 rounded-full bg-slate-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            Sample
          </span>
        ) : null}

        {canPlay && playHref ? (
          isInternal ? (
            <Link
              href={playHref}
              aria-label={`Play ${video.title}`}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-indigo-600 shadow-lg transition-transform group-hover:scale-105">
                <PlayIcon className="ml-0.5 h-5 w-5" />
              </span>
            </Link>
          ) : (
            <a
              href={playHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`Play ${video.title}`}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-indigo-600 shadow-lg transition-transform group-hover:scale-105">
                <PlayIcon className="ml-0.5 h-5 w-5" />
              </span>
            </a>
          )
        ) : video.status === "processing" && video.previewHref ? (
          <Link
            href={video.previewHref}
            aria-label={`View progress for ${video.title}`}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="rounded-full bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              {video.progress ?? 0}% · {video.stageLabel ?? "Processing"}
            </span>
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white/90 ring-1 ring-inset ring-white/30 backdrop-blur-sm">
              <PlayIcon className="ml-0.5 h-5 w-5" />
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={video.status} />
          <span className="text-xs text-slate-400">{video.subject}</span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          {video.title}
        </h3>

        {video.status === "failed" && video.errorMessage ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-rose-600">
            <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{video.errorMessage}</span>
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDate(video.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatDuration(video.durationSeconds)}
          </span>
        </div>

        {showActions ? (
          <div className="mt-auto flex items-center gap-2 pt-4">
            {canPlay && playHref ? (
              <>
                {isInternal ? (
                  <Link
                    href={playHref}
                    className="btn-secondary flex-1 px-3 py-2 text-xs"
                  >
                    <PlayIcon className="h-3.5 w-3.5" />
                    Play
                  </Link>
                ) : (
                  <a
                    href={playHref}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary flex-1 px-3 py-2 text-xs"
                  >
                    <PlayIcon className="h-3.5 w-3.5" />
                    Play
                  </a>
                )}
                <a
                  href={downloadHref}
                  download
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download
                </a>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  title={
                    video.status === "processing"
                      ? "Playback is available when the video is ready"
                      : "No playable file for this video"
                  }
                  className="btn-secondary flex-1 px-3 py-2 text-xs"
                >
                  <PlayIcon className="h-3.5 w-3.5" />
                  Play
                </button>
                <button
                  type="button"
                  disabled
                  title={
                    video.status === "processing"
                      ? "Download is available when the video is ready"
                      : "No file to download for this video"
                  }
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
