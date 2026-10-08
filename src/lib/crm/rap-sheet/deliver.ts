import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { generateRapSheet } from './generate'
import { sendRapSheetEmail } from './email'
import { easternDayBounds } from './offer'
import type { RapSheetContent } from './types'

/** Build the sheet if it has no content yet (or `rebuild`), then email it and stamp emailedAt. */
export async function deliverRapSheet(sheetId: string, opts: { rebuild?: boolean } = {}): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  let sheet = await prisma.crmRapSheet.findUniqueOrThrow({ where: { id: sheetId }, include: { person: { select: { fullName: true } } } })
  if (!sheet.content || opts.rebuild) {
    const r = await generateRapSheet(sheetId)
    if (!r.ok) return { ok: false, emailed: false, error: r.error }
    sheet = await prisma.crmRapSheet.findUniqueOrThrow({ where: { id: sheetId }, include: { person: { select: { fullName: true } } } })
  }
  const org = sheet.orgId ? await prisma.crmOrganization.findUnique({ where: { id: sheet.orgId }, select: { name: true } }) : null
  const emailed = await sendRapSheetEmail(sheet.content as unknown as RapSheetContent, {
    personId: sheet.personId, personName: sheet.person.fullName, orgName: org?.name ?? null,
    meetingTitle: sheet.meetingTitle, meetingAt: sheet.meetingAt,
  })
  if (emailed) await prisma.crmRapSheet.update({ where: { id: sheetId }, data: { emailedAt: new Date() } })
  captureServerEvent('admin', 'rap_sheet_emailed', { sheetId, personId: sheet.personId, emailed })
  return { ok: true, emailed }
}

/** The morning job: every pitch Justin approved for today that hasn't been sent. */
export async function sendTodaysApprovedRapSheets(): Promise<{ approved: number; emailed: number; failed: number }> {
  const { from, to } = easternDayBounds(0)
  const sheets = await prisma.crmRapSheet.findMany({
    where: { status: { in: ['APPROVED', 'READY', 'FAILED'] }, emailedAt: null, decidedAt: { not: null }, meetingAt: { gte: from, lt: to } },
    select: { id: true },
  })
  const results = await Promise.all(sheets.map((s) => deliverRapSheet(s.id)))
  return { approved: sheets.length, emailed: results.filter((r) => r.emailed).length, failed: results.filter((r) => !r.ok).length }
}
