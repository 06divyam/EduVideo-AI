import { formatDuration } from "@/lib/format";
import type { Video, VideoAccent } from "@/lib/types";

const accentStyles: Record<VideoAccent, string> = {
  indigo: "from-indigo-700 via-indigo-600 to-blue-500",
  violet: "from-violet-700 via-purple-600 to-indigo-500",
  blue: "from-blue-700 via-sky-600 to-cyan-500",
  emerald: "from-emerald-700 via-teal-600 to-cyan-500",
  amber: "from-amber-600 via-orange-500 to-rose-500",
  rose: "from-rose-700 via-pink-600 to-fuchsia-500",
  cyan: "from-cyan-700 via-sky-600 to-blue-500",
  slate: "from-slate-800 via-slate-700 to-slate-500",
};

export function VideoThumbnail({ video }: { video: Video }) {
  const accent = accentStyles[video.accent ?? "indigo"];

  return (
    <div
      aria-hidden="true"
      className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${accent}`}
    >
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute right-10 top-8 h-2 w-2 rounded-full bg-white/40" />
      <div className="absolute right-16 top-12 h-1.5 w-1.5 rounded-full bg-white/30" />

      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="w-fit rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-inset ring-white/20">
          {video.subject ?? "Lesson"}
        </span>
        <div>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-sm">
            {video.title}
          </p>
          <p className="mt-1 text-[11px] font-medium text-white/60">
            EduVideo AI lesson
          </p>
        </div>
      </div>

      <span className="absolute bottom-3 right-3 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
        {formatDuration(video.durationSeconds)}
      </span>
    </div>
  );
}
