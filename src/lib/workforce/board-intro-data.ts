import 'server-only'
import { stateSlug, stateName } from '@/lib/seo/states'
import { areaHiring, getOrgPage, getStateOrgList } from '@/lib/seo/org-pages'
import { noticesForOrgPage } from '@/lib/seo/org-notices'
import { getPublicNotices, TWELVE_MONTHS_MS } from '@/lib/warn/layoff-pages'
import { areaPhrase } from '@/lib/org-claims/org-kit'
import { orgPagePath } from '@/lib/seo/org-page-rules'
import { COMPOSE_ACCOUNT, COMPOSE_FROM } from '@/lib/warn/layoff-alert-drafts'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { boardIntroDraft } from './board-intro-draft'
import { kitLink } from '@/lib/org-claims/org-kit'
import { newReferralCode } from '@/lib/candidates/referral'
import { prisma } from '@/lib/prisma'

const SITE = 'https://launchyournextchapter.com'

/**
 * The first email to a workforce board's director, filled from live data (the board's own page numbers and the layoff-notice counts), and the
 * Gmail compose link that opens it from justin@launchyournextchapter.com. Null when the board has no page or no director email.
 */
export async function boardIntroFor(board: { id: string; state: string; directorName: string | null; directorEmail: string | null }): Promise<{ subject: string; body: string; href: string; to: string; toNote: string | null; clicks: number } | null> {
  if (!board.directorEmail) return null
  const list = await getStateOrgList('WORKFORCE_BOARD', stateSlug(board.state))
  const row = list?.rows.find((r) => r.id === board.id || r.aliasIds?.includes(board.id))
  if (!row) return null
  const page = await getOrgPage('WORKFORCE_BOARD', stateSlug(board.state), row.slug)
  if (!page) return null
  const [hiring, local, all] = await Promise.all([areaHiring(page.row.state, page.area), noticesForOrgPage(page), getPublicNotices()])
  const { to, toNote, personId } = await recipientFor(board.directorName, board.directorEmail)
  const pagePath = orgPagePath('WORKFORCE_BOARD', stateSlug(row.state), row.slug)
  const link = await trackedLink(board.id, personId)
  const now = Date.now()
  const nat = all.filter((x) => now - x.noticeDate.getTime() <= TWELVE_MONTHS_MS)
  const draft = boardIntroDraft({
    contactName: board.directorName,
    org: row.name,
    page: link ? kitLink(SITE, link.code, pagePath) : `${SITE}${pagePath}`,
    area: areaPhrase(page.area, stateName(row.state)),
    jobs: page.blocks.jobsOpen,
    entryLevel: page.blocks.entryLevel,
    topEmployers: hiring.employers.map((e) => e.name),
    nationalNotices: nat.length,
    nationalWorkers: nat.reduce((s, x) => s + (x.workers ?? 0), 0),
    areaNotices: local.total,
    areaWorkers: local.workers,
  })
  return { ...draft, href: gmailComposeHref(to, draft.subject, draft.body, COMPOSE_ACCOUNT, COMPOSE_FROM), to, toNote, clicks: link?.clicks ?? 0 }
}

/**
 * Where the email goes. The directory's address is used unless its local part has nothing of the director's surname and the CRM holds a guessed
 * address for that person (first initial + surname at the same domain): then the guess is used and the note says so.
 */
async function recipientFor(name: string | null, email: string): Promise<{ to: string; toNote: string | null; personId: string | null }> {
  const domain = email.split('@')[1]?.toLowerCase()
  const last = name?.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, '')
  if (!name || !domain) return { to: email, toNote: null, personId: null }
  const person = await prisma.crmPerson
    .findFirst({ where: { deletedAt: null, fullName: name, OR: [{ email: { endsWith: `@${domain}`, mode: 'insensitive' } }, { guessedEmail: { endsWith: `@${domain}`, mode: 'insensitive' } }] }, select: { id: true, guessedEmail: true } })
    .catch(() => null)
  const mismatch = !!last && last.length > 2 && !email.split('@')[0].toLowerCase().includes(last)
  if (mismatch && person?.guessedEmail) {
    return { to: person.guessedEmail, toNote: `The directory lists ${email} for ${name}, which looks like someone else's address. This one is a guess from the organization's email format (not verified).`, personId: person.id }
  }
  return { to: email, toNote: mismatch ? `${email} does not look like ${name}'s address. Check it before sending.` : null, personId: person?.id ?? null }
}

/** One tracked link per board for the first email, so its clicks are not mixed with the links the board uses for its own people. */
async function trackedLink(boardId: string, personId: string | null): Promise<{ code: string; clicks: number } | null> {
  try {
    const label = `bi:${boardId}`
    const found = await prisma.referralLink.findFirst({ where: { label }, select: { code: true, clickCount: true } })
    if (found) return { code: found.code, clicks: found.clickCount }
    const made = await prisma.referralLink.create({ data: { code: newReferralCode(), label, kind: 'OTHER', ownerCrmPersonId: personId, createdBy: null }, select: { code: true } })
    return { code: made.code, clicks: 0 }
  } catch {
    return null
  }
}
