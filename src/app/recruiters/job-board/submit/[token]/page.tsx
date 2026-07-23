import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { JobBoardSubmissionForm } from '@/components/jobs/JobBoardSubmissionForm'
import { submitRecruiterJobBoardPosting } from './actions'

export default async function RecruiterJobBoardSubmitPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) notFound()

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Post to NC Job Board</h1>
        <p className="text-muted-foreground">
          Shown only to candidates currently holding an A Market Reality Grade. Every posting needs
          a named contact and a real salary band, and is reviewed by a person before it goes live.
        </p>
      </div>
      <JobBoardSubmissionForm action={submitRecruiterJobBoardPosting.bind(null, token)} />
    </div>
  )
}
