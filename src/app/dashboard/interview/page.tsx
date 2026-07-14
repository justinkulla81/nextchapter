import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { InterviewQuestionForm } from '@/components/dashboard/InterviewQuestionForm'
import { Card, CardContent } from '@/components/ui/card'

export default async function InterviewPage() {
  const profile = await getDashboardData()

  const answeredIds = new Set(profile.interviewResponses.map((r) => r.questionId))

  const questions = await prisma.interviewQuestionBank.findMany({
    where: { isActive: true },
    orderBy: { category: 'asc' },
  })

  const unanswered = questions.filter((q) => !answeredIds.has(q.id))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interview Responses</h1>
        <p className="mt-1 text-muted-foreground">
          Short written answers that give employers real signal beyond your resume.
        </p>
      </div>

      {unanswered.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Unanswered</h2>
          {unanswered.map((q) => (
            <InterviewQuestionForm key={q.id} questionId={q.id} questionText={q.questionText} />
          ))}
        </div>
      )}

      {profile.interviewResponses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Your answers</h2>
          {profile.interviewResponses.map((response) => (
            <Card key={response.id}>
              <CardContent className="space-y-2 pt-6">
                <p className="font-medium">{response.questionText}</p>
                <p className="text-sm text-muted-foreground">{response.responseText}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {unanswered.length === 0 && profile.interviewResponses.length === 0 && (
        <p className="text-muted-foreground">No interview questions available right now.</p>
      )}
    </div>
  )
}
