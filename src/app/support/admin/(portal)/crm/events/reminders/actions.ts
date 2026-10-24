'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { sendTestHeadsUp } from '@/lib/events/send-heads-up'

/** Sends the owner two sample reminders (the early speaking ask and the "how was it" check-in). Sample event, nothing recorded. */
export async function sendTestReminders() {
  const admin = await requireAdmin()
  const to = admin.email
  if (!to) redirect('/support/admin/crm/events/reminders?test=noemail')
  const a = await sendTestHeadsUp(to, null, 'EXPLORE')
  const b = await sendTestHeadsUp(to, null, 'CHECK_IN')
  redirect(`/support/admin/crm/events/reminders?test=${a && b ? 'sent' : 'failed'}`)
}
