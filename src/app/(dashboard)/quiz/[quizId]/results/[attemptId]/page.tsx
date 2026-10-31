import Link from "next/link";
import { QuizIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuizResults } from "@/components/quiz-results";

export default async function QuizResultsPage({
  params,
}: PageProps<"/quiz/[quizId]/results/[attemptId]">) {
  const { attemptId } = await params;

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

      <QuizResults attemptId={attemptId} />
    </div>
  );
}
