'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendLifecycleEmail } from '@/lib/leads/lifecycle/send'
import type { LeadStep, LeadVariant } from '@/lib/leads/lifecycle/config'
import { prisma } from '@/lib/prisma'
import { publicJobLabels } from '@/lib/jobs/public-job-page-server'

// The four emails (plus the business acknowledgement and both reminders) sent
// to the admin only, exactly as a lead would see them, marked [TEST]. Test
// sends are not logged on anyone's CRM record and carry no tracking.
const TESTS: { variant: LeadVariant; step: LeadStep; detail: string | null }[] = [
  { variant: 'saved_job', step: 'welcome', detail: 'Senior Product Manager at Example Co' },
  { variant: 'job_alert', step: 'welcome', detail: 'product manager in Denver' },
  { variant: 'newsletter', step: 'welcome', detail: null },
  { variant: 'waitlist', step: 'welcome', detail: 'general' },
  { variant: 'waitlist_b2b', step: 'welcome', detail: 'Employer' },
  { variant: 'saved_job', step: 'nudge1', detail: 'Senior Product Manager at Example Co' },
  { variant: 'applied_job', step: 'welcome', detail: 'Senior Product Manager at Example Co' },
  { variant: 'applied_job', step: 'nudge1', detail: 'Senior Product Manager at Example Co' },
  { variant: 'saved_job', step: 'nudge2', detail: 'Senior Product Manager at Example Co' },
]

export async function sendLifecycleTests() {
  const admin = await requireAdmin()
  const to = getAccountActivityAdminEmail()
  let sent = 0
  if (to) {
    // The application welcome shows three jobs like the one applied for, so its test uses the latest real application's job.
    const latest = await prisma.homepageLead
      .findFirst({ where: { kind: 'apply_save', followup: { in: ['apply_click', 'apply_gate'] }, searchQ: { not: '' } }, orderBy: { createdAt: 'desc' }, select: { searchQ: true } })
      .catch(() => null)
    const jobId = latest?.searchQ ?? null
    const label = jobId ? (await publicJobLabels([jobId]).catch(() => new Map<string, string>())).get(jobId) ?? null : null
    for (const t of TESTS) {
      const applied = t.variant === 'applied_job' && t.step === 'welcome' && jobId
      const detail = applied && label ? label : t.detail
      if (await sendLifecycleEmail({ email: to, variant: t.variant, step: t.step, context: { firstName: 'Justin', detail }, jobId: applied ? jobId : null, test: true })) sent++
    }
  }
  captureServerEvent(admin.email ?? 'admin', 'lead_lifecycle_tests_sent', { sent })
  redirect(`/support/admin/captured-emails?tested=${sent}`)
}
