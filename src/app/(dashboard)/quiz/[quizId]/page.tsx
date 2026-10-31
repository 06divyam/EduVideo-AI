import Link from "next/link";
import { QuizIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { QuizRunner } from "@/components/quiz-runner";

export default async function QuizDetailPage({
  params,
}: PageProps<"/quiz/[quizId]">) {
  const { quizId } = await params;

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

      <QuizRunner quizId={quizId} />
    </div>
  );
}
