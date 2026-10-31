import Link from "next/link";
import { PlusCircleIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { VideoLibrary } from "@/components/video-library";

export default function VideosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Video library"
        description="Every lesson you have generated. Open one to watch it with captions or download the MP4."
        action={
          <Link href="/create" className="btn-primary">
            <PlusCircleIcon className="h-4 w-4" />
            New video
          </Link>
        }
      />

      <VideoLibrary />
    </div>
  );
}
