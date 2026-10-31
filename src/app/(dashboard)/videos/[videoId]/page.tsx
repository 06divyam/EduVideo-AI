import Link from "next/link";
import { Suspense } from "react";
import { VideoIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { VideoPlayer } from "@/components/video-player";

type Params = PageProps<"/videos/[videoId]">["params"];

export default function VideoDetailPage({ params }: PageProps<"/videos/[videoId]">) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Videos"
        title="Lesson video"
        description="Watch the narrated lesson with captions, download the MP4, or turn the same PDF into a quiz."
        action={
          <Link href="/videos" className="btn-secondary">
            <VideoIcon className="h-4 w-4" />
            All videos
          </Link>
        }
      />

      <Suspense fallback={<LoadingCard />}>
        <VideoPlayerFromParams params={params} />
      </Suspense>
    </div>
  );
}

async function VideoPlayerFromParams({ params }: { params: Params }) {
  const { videoId } = await params;
  return <VideoPlayer videoId={videoId} />;
}

function LoadingCard() {
  return (
    <section className="card p-8">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        Loading video…
      </div>
    </section>
  );
}
