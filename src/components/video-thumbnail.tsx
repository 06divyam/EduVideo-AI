import { formatDuration } from "@/lib/format";
import type { Video, VideoAccent } from "@/lib/types";

// Placeholder thumbnails (samples and videos without a rendered first slide)
// are neutral; the accent only tints a thin top rule so cards stay calm.
const accentRules: Record<VideoAccent, string> = {
  indigo: "bg-brand-500",
  violet: "bg-brand-400",
  blue: "bg-sky-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-600",
  slate: "bg-slate-500",
};

function DurationTag({ seconds }: { seconds: number }) {
  if (!seconds) {
    return null;
  }
  return (
    <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
      {formatDuration(seconds)}
    </span>
  );
}

export function VideoThumbnail({ video }: { video: Video }) {
  if (video.thumbnailUrl) {
    // Real first-slide thumbnail rendered by the backend. A CSS background
    // keeps it decorative (the card already shows the title).
    return (
      <div
        aria-hidden="true"
        className="relative aspect-video w-full overflow-hidden border-b border-slate-200 bg-slate-100 bg-cover bg-center"
        style={{ backgroundImage: `url("${video.thumbnailUrl}")` }}
      >
        <DurationTag seconds={video.durationSeconds} />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="relative aspect-video w-full overflow-hidden border-b border-slate-200 bg-slate-50"
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accentRules[video.accent ?? "slate"]}`} />
      <div className="flex h-full flex-col justify-end p-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {video.subject ?? "Lesson"}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-700">
          {video.title}
        </p>
      </div>
      <DurationTag seconds={video.durationSeconds} />
    </div>
  );
}
