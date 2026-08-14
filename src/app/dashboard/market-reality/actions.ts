'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { captureServerEvent } from '@/lib/posthog/server'

export async function regenerateMarketRealityReport() {
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
  await generateMarketRealityReport(profile.id)

  captureServerEvent(profile.id, 'market_reality_report_regenerated', {})

  revalidatePath('/dashboard/market-reality')
}

export async function resendMyMarketRealityReportEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await sendMarketRealityReportEmail(profile.id)
}
