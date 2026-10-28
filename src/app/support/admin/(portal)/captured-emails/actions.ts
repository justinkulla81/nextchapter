'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendLifecycleEmail } from '@/lib/leads/lifecycle/send'
import type { LeadStep, LeadVariant } from '@/lib/leads/lifecycle/config'

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
  { variant: 'saved_job', step: 'nudge2', detail: 'Senior Product Manager at Example Co' },
]

export async function sendLifecycleTests() {
  const admin = await requireAdmin()
  const to = getAccountActivityAdminEmail()
  let sent = 0
  if (to) {
    for (const t of TESTS) {
      if (await sendLifecycleEmail({ email: to, variant: t.variant, step: t.step, context: { firstName: 'Justin', detail: t.detail }, test: true })) sent++
    }
  }
  captureServerEvent(admin.email ?? 'admin', 'lead_lifecycle_tests_sent', { sent })
  redirect(`/support/admin/captured-emails?tested=${sent}`)
}
