import type { VideoStatus } from "@/lib/types";

const statusStyles: Record<
  VideoStatus,
  { label: string; className: string; dot: string }
> = {
  ready: {
    label: "Ready",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    dot: "bg-amber-500 animate-pulse",
  },
  failed: {
    label: "Failed",
    className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
    dot: "bg-rose-500",
  },
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const style = statusStyles[status];

  return (
    <span className={`badge ${style.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
