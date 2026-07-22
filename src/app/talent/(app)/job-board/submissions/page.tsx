import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { MyJobBoardSubmissions } from '@/components/jobs/MyJobBoardSubmissions'
import { Button } from '@/components/ui/button'
import { reconfirmMyJobBoardPosting } from './actions'

export default async function TalentJobBoardSubmissionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/talent/signup')

  const employer = await prisma.employerProfile.findUnique({ where: { userId: user.id } })
  if (!employer) redirect('/talent/signup')

  const postings = await prisma.exclusiveJobPosting.findMany({
    where: { submittedByEmployerId: employer.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My NC Job Board postings</h1>
          <p className="mt-1 text-muted-foreground">
            Postings expire 30 days after they&apos;re approved unless you confirm the role is
            still open.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/talent/job-board/submit" />}>
          Post another
        </Button>
      </div>
      <MyJobBoardSubmissions postings={postings} reconfirmAction={reconfirmMyJobBoardPosting} />
    </div>
  )
}
