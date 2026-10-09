import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { deliverRapSheet } from '@/lib/crm/rap-sheet/deliver'

// Research with web search can run for a couple of minutes.
export const maxDuration = 300

/**
 * Build Meeting Prep right now and email it. Either rebuilds an existing sheet
 * (sheetId) or starts a one-off for a person (personId) — the path for a pitch
 * that wasn't on the calendar the night before.
 */
export async function POST(request: Request) {
  await requireAdmin()
  const body = (await request.json().catch(() => ({}))) as { personId?: string; sheetId?: string }

  let sheetId = body.sheetId
  if (!sheetId) {
    if (!body.personId) return NextResponse.json({ error: 'personId or sheetId is required.' }, { status: 400 })
    const person = await prisma.crmPerson.findUnique({
      where: { id: body.personId },
      select: { id: true, nextMeetingAt: true, affiliations: { select: { orgId: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1 } },
    })
    if (!person) return NextResponse.json({ error: 'No such person.' }, { status: 404 })
    const sheet = await prisma.crmRapSheet.create({
      data: {
        personId: person.id, orgId: person.affiliations[0]?.orgId ?? null, meetingAt: person.nextMeetingAt,
        status: 'APPROVED', offeredAt: new Date(), decidedAt: new Date(),
      },
    })
    sheetId = sheet.id
  } else {
    await prisma.crmRapSheet.update({ where: { id: sheetId }, data: { decidedAt: new Date(), status: 'APPROVED' } })
  }

  const result = await deliverRapSheet(sheetId, { rebuild: true })
  captureServerEvent('admin', 'rap_sheet_generate_requested', { sheetId, personId: body.personId ?? null, ok: result.ok })
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Could not build the Meeting Prep.', sheetId }, { status: 502 })
  return NextResponse.json({ sheetId, emailed: result.emailed })
}
