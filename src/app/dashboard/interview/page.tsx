import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { InterviewQuestionForm } from '@/components/dashboard/InterviewQuestionForm'
import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

export default async function InterviewPage() {
  const profile = await getDashboardData()

  const answeredByQuestionId = new Map(profile.interviewResponses.map((r) => [r.questionId, r]))

  const questions = await prisma.interviewQuestionBank.findMany({
    where: { isActive: true },
    orderBy: { category: 'asc' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interview Responses</h1>
        <p className="mt-1 text-muted-foreground">
          Short written answers that give employers real signal beyond your resume. Victoria gives
          you feedback after each one — redraft anytime to sharpen it.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="text-muted-foreground">No interview questions available right now.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const existing = answeredByQuestionId.get(q.id)
            return (
              <InterviewQuestionForm
                key={q.id}
                questionId={q.id}
                questionText={q.questionText}
                initialResponse={existing?.responseText ?? null}
                feedback={(existing?.feedback as unknown as PracticeEvaluation | null) ?? null}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
