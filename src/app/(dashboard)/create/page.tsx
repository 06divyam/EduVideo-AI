import Link from "next/link";
import { CreateVideoForm } from "@/components/create-video-form";
import { ArrowRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";

export default function CreateVideoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New video"
        description="Upload a PDF, pick a length, and generate a narrated lesson with slides and captions."
        action={
          <Link href="/videos" className="btn-secondary">
            My videos
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        }
      />

      <CreateVideoForm />
    </div>
  );
}
