import Link from "next/link";
import { PlusCircleIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { VideoLibrary } from "@/components/video-library";
import { sampleVideos } from "@/lib/data";

export default function VideosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My Videos"
        title="Video library"
        description="Search, filter, and review every lesson you create. Playback and downloads unlock when the renderer is connected."
        action={
          <Link href="/create" className="btn-primary">
            <PlusCircleIcon className="h-4 w-4" />
            Create New Video
          </Link>
        }
      />

      <VideoLibrary videos={sampleVideos} />

      <p className="pb-2 text-xs text-slate-400">
        Sample previews are labeled and contain no generated AI output. Real
        videos will be served by the FastAPI backend.
      </p>
    </div>
  );
}
