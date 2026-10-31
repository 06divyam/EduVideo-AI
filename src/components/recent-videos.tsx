"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { AlertTriangleIcon, ArrowRightIcon, VideoIcon } from "@/components/icons";
import { VideoCard } from "@/components/video-card";
import { ApiError, listVideos, toLibraryVideo } from "@/lib/api";
import type { Video } from "@/lib/types";

const RECENT_COUNT = 3;

export function RecentVideos() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await listVideos();
        if (!cancelled) {
          setVideos(result.videos.slice(0, RECENT_COUNT).map(toLibraryVideo));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Recent videos could not be loaded.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <p className="flex items-center gap-2 p-5 text-xs text-rose-600 sm:p-6">
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        {loadError}
      </p>
    );
  }

  if (videos === null) {
    return (
      <div className="flex items-center gap-3 p-5 text-sm text-slate-500 sm:p-6">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        Loading recent videos…
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={VideoIcon}
        title="No videos yet"
        description="Generated lessons will appear here. Start by uploading a PDF on the Create Video page."
        action={
          <Link href="/create" className="btn-primary">
            Create your first video
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} showActions={false} />
      ))}
    </div>
  );
}
