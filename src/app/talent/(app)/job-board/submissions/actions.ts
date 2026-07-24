'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { resolveEmployerForUserId } from '@/lib/talent/get-employer-for-user'
import { reconfirmJobBoardPosting } from '@/lib/jobs/job-board-submission'

export async function reconfirmMyJobBoardPosting(postingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const employer = await resolveEmployerForUserId(user.id)
  if (!employer) return

  // Only the original submitter can reconfirm their own posting.
  const posting = await prisma.exclusiveJobPosting.findUnique({ where: { id: postingId } })
  if (!posting || posting.submittedByEmployerId !== employer.id) return

  await reconfirmJobBoardPosting(postingId)
  revalidatePath('/talent/job-board/submissions')
}
