import 'server-only'
import { prisma } from '@/lib/prisma'
import { logHelpOnCrm } from '@/lib/help/crm-note'
import { notifyAdminOfHelp } from '@/lib/help/notify'

const DEDUPE_MINUTES = 30

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
  return text || null
}

export type ErrorReportInput = { path: unknown; digest: unknown; title?: unknown; userAgent?: string | null }

/**
 * The error screen's "Tell us" button: files a Problem in the Help inbox for the signed-in member with the page and the
 * error reference attached, so they write nothing. The ticket is the same kind a typed problem report makes (admin email with the
 * ticket and CRM links, a note on their CRM record). Asked again for the same page inside 30 minutes, it returns the open ticket
 * instead of filing a second one, so a member who presses the button twice, or reloads into the same error, makes one ticket.
 */
export async function fileErrorReport(candidateId: string, input: ErrorReportInput, after: (work: () => Promise<unknown>) => void): Promise<{ requestId: string; duplicate: boolean }> {
  const path = clean(input.path, 300) ?? 'unknown page'
  const digest = clean(input.digest, 80)
  const title = clean(input.title, 200)

  const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000)
  const existing = await prisma.helpRequest.findFirst({
    where: { candidateId, kind: 'PROBLEM', contextPath: path, createdAt: { gte: since }, subject: { startsWith: 'Page error' } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return { requestId: existing.id, duplicate: true }

  const subject = `Page error on ${path}`.slice(0, 90)
  const message = [
    'This was sent automatically when the member pressed “Tell us” on the error screen.',
    `Page: ${path}`,
    digest ? `Error reference: ${digest}` : null,
    `Time: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  const request = await prisma.helpRequest.create({
    data: {
      candidateId, kind: 'PROBLEM', subject, contextPath: path, contextTitle: title, userAgent: input.userAgent?.slice(0, 300) ?? null,
      flaggedCrisis: false, messages: { create: { body: message } },
    },
  })
  after(async () => {
    await logHelpOnCrm(candidateId, `Reported a problem: ${subject}`, message, `help:${request.id}`)
    await notifyAdminOfHelp(request.id, message, false)
  })
  return { requestId: request.id, duplicate: false }
}
