import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  FileTextIcon,
  PlayIcon,
  PlusCircleIcon,
  QuizIcon,
  SparklesIcon,
  UploadIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ProgressOverview } from "@/components/progress-overview";
import { RecentVideos } from "@/components/recent-videos";

const steps = [
  {
    title: "Upload your material",
    description: "Add an educational PDF and extract its text securely.",
    icon: UploadIcon,
  },
  {
    title: "Generate smart notes",
    description: "Gemini writes topic-wise explanations, definitions, and revision notes.",
    icon: SparklesIcon,
  },
  {
    title: "Practice and improve",
    description: "Take timed quizzes, review explanations, and track weak topics.",
    icon: QuizIcon,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Learn smarter. Practice better."
        description="EduVideo AI turns your PDFs into smart study notes, timed quizzes, and narrated explainer videos — built for the education track."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/quiz" className="btn-secondary">
              <QuizIcon className="h-4 w-4" />
              Take a Quiz
            </Link>
            <Link href="/create" className="btn-primary">
              <PlusCircleIcon className="h-4 w-4" />
              Upload PDF
            </Link>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50" />
        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="badge bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
              <SparklesIcon className="h-3.5 w-3.5" />
              PDF to learning session, powered by AI
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Turn any PDF into a{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                lesson worth learning.
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Upload a chapter, lecture note, or study guide. EduVideo AI writes
              topic-wise notes, generates a timed exam, and tracks the topics
              that need more practice.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/study" className="btn-primary">
                Generate study notes
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/videos" className="btn-secondary">
                Explore library
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <li className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                Topic-wise notes
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                Timed quizzes
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                Weak-topic tracking
              </li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-indigo-500/10 to-violet-500/10 blur-xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl shadow-indigo-900/10">
              <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-500 p-5 text-white">
                <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
                <div className="absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-white/10" />
                <span className="badge bg-white/15 text-white ring-1 ring-inset ring-white/20">
                  Biology · Lesson preview
                </span>
                <div className="absolute bottom-5 left-5 right-16">
                  <p className="text-xs font-medium text-indigo-200">
                    Photosynthesis
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-snug">
                    How plants turn sunlight into sugar
                  </p>
                </div>
                <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-inset ring-white/30">
                  <PlayIcon className="ml-0.5 h-4 w-4" />
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Narration + slides
                  </span>
                  <span className="text-slate-400">02:14 / 10:12</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-1.5 w-2/3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge bg-slate-100 text-slate-600">
                    AI script
                  </span>
                  <span className="badge bg-slate-100 text-slate-600">
                    Voiceover
                  </span>
                  <span className="badge bg-slate-100 text-slate-600">
                    Subtitles
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -right-3 bottom-16 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-900/5 sm:flex">
              <QuizIcon className="h-4 w-4 text-violet-500" />
              5-question quiz included
            </div>
            <div className="absolute -left-4 top-10 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-900/5 sm:flex">
              <BookOpenIcon className="h-4 w-4 text-indigo-500" />
              Scene-by-scene script
            </div>
          </div>
        </div>
      </section>

      <ProgressOverview />

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Recent videos
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Your latest narrated lessons, generated from uploaded PDFs.
            </p>
          </div>
          <Link
            href="/videos"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            View all
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <RecentVideos />
      </section>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              How it works
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              From source material to a review-ready lesson in three steps.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div key={step.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
        <FileTextIcon className="h-4 w-4" />
        Education track only. Videos, study notes, and quizzes are generated by
        Gemini from your uploaded PDFs.
      </p>
    </div>
  );
}
