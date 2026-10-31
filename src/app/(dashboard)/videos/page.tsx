import Link from "next/link";
import { PlusCircleIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { VideoLibrary } from "@/components/video-library";

export default function VideosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My Videos"
        title="Video library"
        description="Search, filter, and review every lesson you create. Open a video to watch it with captions or download the MP4."
        action={
          <Link href="/create" className="btn-primary">
            <PlusCircleIcon className="h-4 w-4" />
            Create New Video
          </Link>
        }
      />

      <VideoLibrary />

      <p className="pb-2 text-xs text-slate-400">
        Videos are generated from your uploaded PDFs and served by the FastAPI
        backend.
      </p>
    </div>
  );
}
