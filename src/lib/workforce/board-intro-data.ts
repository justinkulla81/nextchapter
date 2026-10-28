import 'server-only'
import { stateSlug, stateName } from '@/lib/seo/states'
import { areaHiring, getOrgPage, getStateOrgList } from '@/lib/seo/org-pages'
import { noticesForOrgPage } from '@/lib/seo/org-notices'
import { getPublicNotices, TWELVE_MONTHS_MS } from '@/lib/warn/layoff-pages'
import { areaPhrase } from '@/lib/org-claims/org-kit'
import { orgPagePath } from '@/lib/seo/org-page-rules'
import { COMPOSE_ACCOUNT } from '@/lib/warn/layoff-alert-drafts'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { boardIntroDraft } from './board-intro-draft'

const SITE = 'https://launchyournextchapter.com'

/**
 * The first email to a workforce board's director, filled from live data (the board's own page numbers and the layoff-notice counts), and the
 * Gmail compose link that opens it from justin@launchyournextchapter.com. Null when the board has no page or no director email.
 */
export async function boardIntroFor(board: { id: string; state: string; directorName: string | null; directorEmail: string | null }): Promise<{ subject: string; body: string; href: string; to: string } | null> {
  if (!board.directorEmail) return null
  const list = await getStateOrgList('WORKFORCE_BOARD', stateSlug(board.state))
  const row = list?.rows.find((r) => r.id === board.id || r.aliasIds?.includes(board.id))
  if (!row) return null
  const page = await getOrgPage('WORKFORCE_BOARD', stateSlug(board.state), row.slug)
  if (!page) return null
  const [hiring, local, all] = await Promise.all([areaHiring(page.row.state, page.area), noticesForOrgPage(page), getPublicNotices()])
  const now = Date.now()
  const nat = all.filter((x) => now - x.noticeDate.getTime() <= TWELVE_MONTHS_MS)
  const draft = boardIntroDraft({
    contactName: board.directorName,
    org: row.name,
    page: `${SITE}${orgPagePath('WORKFORCE_BOARD', stateSlug(row.state), row.slug)}`,
    area: areaPhrase(page.area, stateName(row.state)),
    jobs: page.blocks.jobsOpen,
    entryLevel: page.blocks.entryLevel,
    topEmployers: hiring.employers.map((e) => e.name),
    nationalNotices: nat.length,
    nationalWorkers: nat.reduce((s, x) => s + (x.workers ?? 0), 0),
    areaNotices: local.total,
    areaWorkers: local.workers,
  })
  return { ...draft, href: gmailComposeHref(board.directorEmail, draft.subject, draft.body, COMPOSE_ACCOUNT), to: board.directorEmail }
}
