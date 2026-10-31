import Link from "next/link";
import { CreateVideoForm } from "@/components/create-video-form";
import { ArrowRightIcon, PlusCircleIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";

export default function CreateVideoPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Create Video"
        title="Start a new lesson"
        description="Upload educational material, choose how it should be taught, and prepare a narrated explainer video."
        action={
          <Link href="/videos" className="btn-secondary">
            My Videos
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      />

      <CreateVideoForm />

      <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
        <PlusCircleIcon className="h-4 w-4" />
        Education track only. PDF text extraction is live; lesson generation is
        disabled until Gemini is connected.
      </p>
    </div>
  );
}
