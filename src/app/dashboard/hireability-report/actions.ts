'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'

export async function regenerateHireabilityReport() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  const fullProfile = await prisma.candidateProfile.findUnique({
    where: { id: profile.id },
    include: { resumes: true, workSamples: true, references: true, communityPosts: true },
  })
  if (!fullProfile || countCompletedTasks(fullProfile) < TASKS_REQUIRED_TO_REGENERATE_REPORT) {
    // Not enough completed tasks yet — enforced server-side since the
    // button itself is hidden client-side but the action is still callable.
    return
  }

  // User-initiated — run synchronously so the page can show a loading state,
  // unlike the onboarding auto-trigger which defers via after(). Does not
  // re-send the email (only the first auto-generated report is emailed) to
  // avoid spamming candidates who click regenerate repeatedly.
  await generateHireabilityReport(profile.id)

  revalidatePath('/dashboard/hireability-report')
}

export async function resendMyHireabilityReportEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await sendHireabilityReportEmail(profile.id)
}
