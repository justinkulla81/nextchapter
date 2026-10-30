import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { dueKey, PAUSE_DAYS, verifyDigestAction } from '@/lib/crm/digest-action-link'

// One-click Done / Pause from the daily digest. GET only shows a page that
// submits itself; the change happens on POST, so a mail scanner or link
// preview that opens the URL cannot finish or push out a follow-up. The page
// has a button for when scripts are off.
const HEAD = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NextChapter</title></head>`
const BODY_OPEN = `<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:480px;margin:64px auto;padding:0 24px;color:#1d2330">`

function page(inner: string, status = 200) {
  return new NextResponse(`${HEAD}${BODY_OPEN}${inner}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

const BAD_LINK = `<p>This link has expired or is not valid. Open the person in the CRM instead.</p><p><a href="https://launchyournextchapter.com/support/admin/crm" style="color:#1a56db">Open CRM</a></p>`

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const v = verifyDigestAction(token)
  if (!v) return page(BAD_LINK, 400)
  const label = v.action === 'done' ? 'Mark this follow-up done' : `Pause this follow-up for ${PAUSE_DAYS} days`
  return page(
    `<form method="post"><p>${label}.</p><button type="submit" style="font-size:16px;padding:10px 18px;border-radius:6px;border:1px solid #1a56db;background-color:#1a56db;color:#ffffff;cursor:pointer">Confirm</button></form><script>document.forms[0].submit()</script>`
  )
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const v = verifyDigestAction(token)
  if (!v) return page(BAD_LINK, 400)

  const person = await prisma.crmPerson.findFirst({
    where: { id: v.personId, deletedAt: null },
    select: { id: true, fullName: true, nextFollowUpAt: true },
  })
  const crm = `<p><a href="https://launchyournextchapter.com/support/admin/crm/people/${v.personId}" style="color:#1a56db">Open in CRM</a></p>`
  if (!person) return page(`<p>That person is no longer in the CRM.</p>`, 404)
  // The link was issued for one follow-up date. If it has changed since (done
  // already, paused already, or re-set by hand) do nothing rather than undo it.
  if (!person.nextFollowUpAt || dueKey(person.nextFollowUpAt) !== v.due) {
    return page(`<p><b>${escapeHtml(person.fullName)}</b>: this follow-up was already updated, so nothing changed.</p>${crm}`)
  }

  if (v.action === 'done') {
    await prisma.crmPerson.update({
      where: { id: person.id },
      data: { nextFollowUpAt: null, nextFollowUpNote: null },
    })
    captureServerEvent('daily-digest', 'crm_followup_cleared', { personId: person.id, via: 'digest_link' })
    return page(`<p><b>${escapeHtml(person.fullName)}</b>: follow-up marked done.</p>${crm}`)
  }

  const until = new Date()
  until.setUTCDate(until.getUTCDate() + PAUSE_DAYS)
  until.setUTCHours(12, 0, 0, 0)
  await prisma.crmPerson.update({ where: { id: person.id }, data: { nextFollowUpAt: until } })
  captureServerEvent('daily-digest', 'crm_followup_paused', { personId: person.id, days: PAUSE_DAYS, via: 'digest_link' })
  const when = until.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return page(`<p><b>${escapeHtml(person.fullName)}</b>: paused until ${when}. It comes back in the digest then.</p>${crm}`)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
