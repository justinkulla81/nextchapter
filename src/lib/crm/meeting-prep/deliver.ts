import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { generateMeetingPrep } from './generate'
import { sendMeetingPrepEmail, sendMeetingPrepDigestEmail } from './email'
import { easternDayBounds } from './offer'
import type { MeetingPrepContent, MeetingPrepMeta } from './types'

type Prepared = { ok: true; content: MeetingPrepContent; meta: MeetingPrepMeta; personId: string } | { ok: false; error: string }

/** Build the sheet if it has no content yet (or `rebuild`) and gather what the email needs; sends nothing. */
async function prepareMeetingPrep(sheetId: string, opts: { rebuild?: boolean } = {}): Promise<Prepared> {
  let sheet = await prisma.crmMeetingPrep.findUniqueOrThrow({ where: { id: sheetId }, include: { person: { select: { fullName: true } } } })
  if (!sheet.content || opts.rebuild) {
    const r = await generateMeetingPrep(sheetId)
    if (!r.ok) return { ok: false, error: r.error ?? 'generation failed' }
    sheet = await prisma.crmMeetingPrep.findUniqueOrThrow({ where: { id: sheetId }, include: { person: { select: { fullName: true } } } })
  }
  const org = sheet.orgId ? await prisma.crmOrganization.findUnique({ where: { id: sheet.orgId }, select: { name: true } }) : null
  return {
    ok: true,
    content: sheet.content as unknown as MeetingPrepContent,
    personId: sheet.personId,
    meta: { personId: sheet.personId, personName: sheet.person.fullName, orgName: org?.name ?? null, meetingTitle: sheet.meetingTitle, meetingAt: sheet.meetingAt },
  }
}

/** Build the sheet if it has no content yet (or `rebuild`), then email it and stamp emailedAt. */
export async function deliverMeetingPrep(sheetId: string, opts: { rebuild?: boolean } = {}): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const prepared = await prepareMeetingPrep(sheetId, opts)
  if (!prepared.ok) return { ok: false, emailed: false, error: prepared.error }
  const emailed = await sendMeetingPrepEmail(prepared.content, prepared.meta)
  if (emailed) await prisma.crmMeetingPrep.update({ where: { id: sheetId }, data: { emailedAt: new Date() } })
  captureServerEvent('admin', 'rap_sheet_emailed', { sheetId, personId: prepared.personId, emailed })
  return { ok: true, emailed }
}

/** The morning job: every pitch Justin approved for today that hasn't been sent, in a single email. */
export async function sendTodaysApprovedMeetingPreps(): Promise<{ approved: number; emailed: number; failed: number }> {
  const { from, to } = easternDayBounds(0)
  const sheets = await prisma.crmMeetingPrep.findMany({
    where: { status: { in: ['APPROVED', 'READY', 'FAILED'] }, emailedAt: null, decidedAt: { not: null }, meetingAt: { gte: from, lt: to } },
    select: { id: true },
  })
  const prepared = await Promise.all(sheets.map(async (s) => ({ id: s.id, p: await prepareMeetingPrep(s.id) })))
  const ready = prepared.flatMap((x) => (x.p.ok ? [{ id: x.id, content: x.p.content, meta: x.p.meta }] : []))
  const failed = prepared.length - ready.length
  const sent = await sendMeetingPrepDigestEmail(ready.map(({ content, meta }) => ({ content, meta })))
  if (sent) {
    await prisma.crmMeetingPrep.updateMany({ where: { id: { in: ready.map((r) => r.id) } }, data: { emailedAt: new Date() } })
  }
  for (const r of ready) captureServerEvent('admin', 'rap_sheet_emailed', { sheetId: r.id, personId: r.meta.personId, emailed: sent })
  return { approved: sheets.length, emailed: sent ? ready.length : 0, failed }
}
