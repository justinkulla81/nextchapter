'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { reconfirmJobBoardPosting } from '@/lib/jobs/job-board-submission'

export async function reconfirmMyRecruiterJobBoardPosting(token: string, postingId: string) {
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) return

  const posting = await prisma.exclusiveJobPosting.findUnique({ where: { id: postingId } })
  if (!posting || posting.submittedByRecruiterId !== recruiter.id) return

  await reconfirmJobBoardPosting(postingId)
  revalidatePath(`/recruiters/job-board/submissions/${token}`)
}
