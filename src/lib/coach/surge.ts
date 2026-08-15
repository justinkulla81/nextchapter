import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'
import { captureServerEvent } from '@/lib/posthog/server'

export interface SurgeSignal {
  newSignupsLast24h: number
  benchCoachCount: number
  threshold: number | null
  overThreshold: boolean
}

// §A5.4 surge capacity — real signal, manual trigger (see this phase's scope
// note: full automated detection is bigger than one phase). New-signups-
// per-day is the volume signal a 200-person RIF would actually produce;
// admin sets the threshold in CoachingSettings, and this just reads it
// against a real count so the admin page can suggest "you're over the
// threshold" without silently emailing anyone on its own.
export async function getSurgeSignal(): Promise<SurgeSignal> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [newSignupsLast24h, benchCoachCount, settings] = await Promise.all([
    prisma.candidateProfile.count({ where: { registrationCompletedAt: { gte: oneDayAgo } } }),
    prisma.coach.count({ where: { isOnCallBench: true, isSampleData: false } }),
    getCoachingSettings(),
  ])
  const threshold = settings.surgeCapacityBenchThreshold
  return {
    newSignupsLast24h,
    benchCoachCount,
    threshold,
    overThreshold: threshold !== null && newSignupsLast24h >= threshold,
  }
}

async function sendSurgeOutreachEmail(coachEmail: string, fullName: string, note: string | null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping surge outreach email.')
    return false
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: coachEmail,
      subject: 'Surge capacity — can you take on clients this week?',
      html: `<p>Hi ${fullName.split(' ')[0] || fullName},</p><p>We're seeing a real spike in new candidates and could use your help picking up extra sessions this week if you have capacity.</p>${note ? `<p>${note}</p>` : ''}<p>Reply to this email or reach out to admin to confirm how many clients you can take.</p><p>— NextChapter</p>`,
    })
    if (error) {
      console.error('Failed to send surge outreach email:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Failed to send surge outreach email:', error)
    return false
  }
}

// Admin's manual "trigger surge outreach" action — emails every on-call
// bench coach and records a real audit row (SurgeOutreachEvent) so "did we
// notify the bench, who, and when" has a durable answer instead of living
// only in an inbox.
export async function triggerSurgeOutreach(actor: string, note: string | null) {
  const [benchCoaches, signal] = await Promise.all([
    prisma.coach.findMany({ where: { isOnCallBench: true, isSampleData: false }, select: { id: true, fullName: true, workEmail: true } }),
    getSurgeSignal(),
  ])

  const notifiedCoachIds: string[] = []
  for (const coach of benchCoaches) {
    const sent = await sendSurgeOutreachEmail(coach.workEmail, coach.fullName, note)
    if (sent) notifiedCoachIds.push(coach.id)
  }

  const event = await prisma.surgeOutreachEvent.create({
    data: {
      triggeredBy: actor,
      newSignupsInWindow: signal.newSignupsLast24h,
      benchCoachCount: benchCoaches.length,
      notifiedCoachIds,
      note,
    },
  })

  captureServerEvent(actor, 'surge_outreach_triggered', {
    eventId: event.id,
    benchCoachCount: benchCoaches.length,
    notifiedCount: notifiedCoachIds.length,
    newSignupsLast24h: signal.newSignupsLast24h,
  })

  return event
}
