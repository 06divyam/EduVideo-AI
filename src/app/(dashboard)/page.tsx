import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  PlusCircleIcon,
  QuizIcon,
  UploadIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ProgressOverview } from "@/components/progress-overview";
import { RecentVideos } from "@/components/recent-videos";

const steps = [
  {
    title: "Upload a PDF",
    description: "Lecture notes, a textbook chapter, or a study guide.",
  },
  {
    title: "Generate the lesson",
    description: "Gemini writes the script, Murf narrates it, and slides are rendered.",
  },
  {
    title: "Watch and practice",
    description: "Play or download the MP4, then take a quiz on the same PDF.",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Turn educational PDFs into narrated lesson videos, study notes, and quizzes."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/quiz" className="btn-secondary">
              <QuizIcon className="h-4 w-4" />
              Take a quiz
            </Link>
            <Link href="/create" className="btn-primary">
              <PlusCircleIcon className="h-4 w-4" />
              New video
            </Link>
          </div>
        }
      />

      <section className="card grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Create a lesson video from a PDF
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            A 2-minute video takes about 15 seconds to generate.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/create" className="btn-primary">
              <UploadIcon className="h-4 w-4" />
              Upload PDF
            </Link>
            <Link href="/study" className="btn-secondary">
              <BookOpenIcon className="h-4 w-4" />
              Study notes
            </Link>
          </div>
        </div>

        <ol className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 sm:block">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-medium tabular-nums text-slate-600">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900 sm:mt-2">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="section-title">Recent videos</h2>
          <Link href="/videos" className="link text-xs">
            View all
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        <RecentVideos />
      </section>

      <ProgressOverview />
    </div>
  );
}
