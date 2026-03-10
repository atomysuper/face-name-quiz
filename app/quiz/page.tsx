import { QuizGame } from '@/components/quiz-game';
import { requireSitePage } from '@/lib/site-auth';

export default async function QuizPage() {
  await requireSitePage();
  return <QuizGame />;
}
