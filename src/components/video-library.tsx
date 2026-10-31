"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  InfoIcon,
  PlusCircleIcon,
  SearchIcon,
  VideoIcon,
  XIcon,
} from "@/components/icons";
import { VideoCard } from "@/components/video-card";
import type { Video, VideoStatus } from "@/lib/types";

type StatusFilter = "all" | VideoStatus;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

export function VideoLibrary({ videos }: { videos: Video[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = useMemo(
    () => ({
      all: videos.length,
      ready: videos.filter((video) => video.status === "ready").length,
      processing: videos.filter((video) => video.status === "processing")
        .length,
      failed: videos.filter((video) => video.status === "failed").length,
    }),
    [videos],
  );

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return videos.filter((video) => {
      const matchesStatus = status === "all" || video.status === status;
      const matchesSearch =
        query.length === 0 ||
        video.title.toLowerCase().includes(query) ||
        (video.subject?.toLowerCase().includes(query) ?? false);

      return matchesStatus && matchesSearch;
    });
  }, [search, status, videos]);

  const hasFilters = search.trim().length > 0 || status !== "all";

  return (
    <div className="space-y-4">
      {videos.some((video) => video.isSample) ? (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="text-xs leading-relaxed text-indigo-900">
            <span className="font-semibold">Sample previews.</span> These cards
            show the library experience. Playback and downloads unlock after the
            backend renders real MP4 files.
          </p>
        </div>
      ) : null}

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or subject..."
              aria-label="Search videos"
              className="input pl-10 pr-10"
            />
            {search.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div
            role="group"
            aria-label="Filter videos by status"
            className="flex flex-wrap items-center gap-1.5"
          >
            {statusFilters.map((filter) => {
              const active = status === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatus(filter.value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded px-1 text-[10px] font-semibold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {counts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={VideoIcon}
            title="Your library is empty"
            description="Generated lessons will appear here. Upload a PDF or paste your notes to create your first narrated video."
            action={
              <Link href="/create" className="btn-primary">
                <PlusCircleIcon className="h-4 w-4" />
                Create a video
              </Link>
            }
          />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={SearchIcon}
            title="No videos match"
            description="Try a different search term or status filter."
            compact
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {filteredVideos.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700">
              {videos.length}
            </span>{" "}
            videos
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
          {hasFilters ? (
            <p className="text-xs text-slate-400">
              Filters are applied locally. Real results will come from the
              backend video library.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
