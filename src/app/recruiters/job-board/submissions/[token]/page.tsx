import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { MyJobBoardSubmissions } from '@/components/jobs/MyJobBoardSubmissions'
import { Button } from '@/components/ui/button'
import { reconfirmMyRecruiterJobBoardPosting } from './actions'

export default async function RecruiterJobBoardSubmissionsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) notFound()

  const postings = await prisma.exclusiveJobPosting.findMany({
    where: { submittedByRecruiterId: recruiter.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
          <h1 className="text-2xl font-semibold tracking-tight">My Job Board postings</h1>
          <p className="mt-1 text-muted-foreground">
            Postings expire 30 days after they&apos;re approved unless you confirm the role is
            still open.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href={`/recruiters/job-board/submit/${token}`} />}>
          Post another
        </Button>
      </div>
      <MyJobBoardSubmissions
        postings={postings}
        reconfirmAction={reconfirmMyRecruiterJobBoardPosting.bind(null, token)}
      />
    </div>
  )
}
