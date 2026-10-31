import Link from "next/link";
import { Suspense } from "react";
import { QuizIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuizRunner } from "@/components/quiz-runner";

type Params = PageProps<"/quiz/[quizId]">["params"];

export default function QuizDetailPage({ params }: PageProps<"/quiz/[quizId]">) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam mode"
        title="Timed quiz"
        description="Answer each question, keep an eye on the timer, and submit before time runs out."
        action={
          <Link href="/quiz" className="btn-secondary">
            <QuizIcon className="h-4 w-4" />
            All quizzes
          </Link>
        }
      />

      <Suspense fallback={<LoadingCard />}>
        <QuizRunnerFromParams params={params} />
      </Suspense>
    </div>
  );
}

async function QuizRunnerFromParams({ params }: { params: Params }) {
  const { quizId } = await params;
  return <QuizRunner quizId={quizId} />;
}

function LoadingCard() {
  return (
    <section className="card p-8">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        Loading exam…
      </div>
    </section>
  );
}
