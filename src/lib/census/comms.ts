// The daily census emails, each only where the org switched it on:
//   - outplacement join reminders (a fresh sign-in link, days 5 and 12),
//   - outplacement access-ending notices (14 days before),
//   - college invitation reminders (the join email again, days 5 and 12).
// Sample seats and demo colleges never email; college sends go through
// sendCampaign (suppression, do-not-contact, unsubscribe).

import 'server-only'
import { prisma } from '@/lib/prisma'
import { readComms, NOTICE_DAYS_BEFORE, REMINDER_DAYS } from './comms-settings'
import { readProgramSettings } from '@/lib/employer/program-settings'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { sendOutplacementAccessEndingEmail, sendOutplacementSeatInviteEmail } from '@/lib/email/send-outplacement-emails'
import { sendCampaign } from '@/lib/higher-ed/outreach'
import { callbackOriginForAppPath, urlForAppPath } from '@/lib/portal-hosts'

const DAY = 86_400_000
const BATCH = 200

// Which reminder (0 or 1) is due for someone first invited at `invitedAt`
// who has had `sent` reminders, or null.
export function reminderDue(invitedAt: Date, sent: number, now: Date): number | null {
  if (sent >= REMINDER_DAYS.length) return null
  return now.getTime() - invitedAt.getTime() >= REMINDER_DAYS[sent] * DAY ? sent : null
}

export async function runOutplacementComms(now = new Date()) {
  const orgs = (await prisma.outplacementEmployerOrg.findMany({ select: { id: true, name: true, programSettings: true } })).filter((o) => {
    const c = readProgramSettings(o.programSettings).comms
    return c.joinReminders || c.accessEndingNotice
  })
  let reminders = 0
  let notices = 0
  for (const org of orgs) {
    const settings = readProgramSettings(org.programSettings)
    if (settings.comms.joinReminders) {
      const seats = await prisma.outplacementSeat.findMany({
        where: { contract: { orgId: org.id, status: 'ACTIVE' }, status: 'INVITED', isSampleData: false, reminderCount: { lt: REMINDER_DAYS.length }, enrolledAt: { lte: new Date(now.getTime() - REMINDER_DAYS[0] * DAY) } },
        select: { id: true, invitedEmail: true, inviteToken: true, enrolledAt: true, reminderCount: true, lastReminderAt: true, packageKey: true, contract: { select: { programType: true } } },
        take: BATCH,
      })
      for (const s of seats) {
        if (reminderDue(s.enrolledAt, s.reminderCount, now) === null) continue
        if (s.lastReminderAt && now.getTime() - s.lastReminderAt.getTime() < 5 * DAY) continue
        const { actionLink } = await createPreConfirmedInviteUser(s.invitedEmail, `${callbackOriginForAppPath('/dashboard')}/auth/callback?next=outplacement-seat&inviteToken=${s.inviteToken}`, { isFirstSend: false })
        if (!actionLink) continue
        const r = await sendOutplacementSeatInviteEmail(s.invitedEmail, org.name, actionLink, { welcome: settings.welcome, services: [] }, { reminder: true, programType: s.contract.programType })
        if (!r.sent) continue
        await prisma.outplacementSeat.update({ where: { id: s.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } })
        reminders++
      }
    }
    if (settings.comms.accessEndingNotice) {
      const soon = new Date(now.getTime() + NOTICE_DAYS_BEFORE * DAY)
      const seats = await prisma.outplacementSeat.findMany({
        where: {
          contract: { orgId: org.id },
          status: 'ACTIVATED',
          isSampleData: false,
          accessNoticeAt: null,
          OR: [{ accessEndsAt: { gt: now, lte: soon } }, { accessEndsAt: null, contract: { termEndAt: { gt: now, lte: soon } } }],
        },
        select: { id: true, invitedEmail: true, accessEndsAt: true, contract: { select: { termEndAt: true, journey: true } } },
        take: BATCH,
      })
      const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
      for (const s of seats) {
        const ends = s.accessEndsAt ?? s.contract.termEndAt
        if (!ends) continue
        const r = await sendOutplacementAccessEndingEmail(s.invitedEmail, org.name, fmt.format(ends), urlForAppPath('/dashboard'), { growth: !!s.contract.journey && s.contract.journey !== 'LAID_OFF' })
        if (!r.sent) continue
        await prisma.outplacementSeat.update({ where: { id: s.id }, data: { accessNoticeAt: now } })
        notices++
      }
    }
  }
  return { orgs: orgs.length, reminders, notices }
}

export async function runCollegeInviteReminders(now = new Date()) {
  const colleges = (await prisma.institution.findMany({ where: { isDemo: false }, select: { id: true, name: true, programBrandName: true, enabledFeatures: true } })).filter((c) => readComms(c.enabledFeatures).joinReminders)
  let sent = 0
  for (const inst of colleges) {
    const members = await prisma.institutionMember.findMany({
      where: {
        institutionId: inst.id,
        status: 'INVITED',
        candidateId: null,
        doNotContact: false,
        emailSuppressedAt: null,
        affiliation: { not: 'LEARNER' },
        outreachSends: { some: { campaign: { type: 'WELCOME' }, createdAt: { lte: new Date(now.getTime() - REMINDER_DAYS[0] * DAY) } } },
      },
      select: { id: true, outreachSends: { where: { campaign: { type: 'WELCOME' } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } } },
      take: 2000,
    })
    const due = members
      .filter((m) => {
        const first = m.outreachSends[0]?.createdAt
        const last = m.outreachSends[m.outreachSends.length - 1]?.createdAt
        if (!first || !last) return false
        // The first send was the invitation; reminders are sends 2 and 3.
        const k = reminderDue(first, m.outreachSends.length - 1, now)
        return k !== null && now.getTime() - last.getTime() >= 5 * DAY
      })
      .slice(0, BATCH)
    if (!due.length) continue
    const brand = inst.programBrandName ?? inst.name
    const r = await sendCampaign({
      institutionId: inst.id,
      type: 'WELCOME',
      subject: `Reminder: your ${inst.name} career toolkit is waiting`,
      body: `Hi {{firstName}},

A quick reminder: ${inst.name} gives every alum ${brand}, free. A clear read on your job market, a plan for this week, coaching, and alumni who'll take your call.

Join in one click: {{link}}

${inst.name} Alumni Relations`,
      createdBy: 'census-reminder',
      recipients: due.map((m) => ({ memberId: m.id })),
    })
    sent += r.sent
  }
  return { colleges: colleges.length, sent }
}
