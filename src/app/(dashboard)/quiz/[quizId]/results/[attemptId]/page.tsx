import Link from "next/link";
import { Suspense } from "react";
import { QuizIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuizResults } from "@/components/quiz-results";

type Params = PageProps<"/quiz/[quizId]/results/[attemptId]">["params"];

export default function QuizResultsPage({ params }: PageProps<"/quiz/[quizId]/results/[attemptId]">) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exam results"
        title="Review your attempt"
        description="See your score, explanations for every question, and the topics that need more practice."
        action={
          <Link href="/quiz" className="btn-secondary">
            <QuizIcon className="h-4 w-4" />
            All quizzes
          </Link>
        }
      />

      <Suspense fallback={<LoadingCard />}>
        <QuizResultsFromParams params={params} />
      </Suspense>
    </div>
  );
}

async function QuizResultsFromParams({ params }: { params: Params }) {
  const { attemptId } = await params;
  return <QuizResults attemptId={attemptId} />;
}

function LoadingCard() {
  return (
    <section className="card p-8">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        Loading your results…
      </div>
    </section>
  );
}
