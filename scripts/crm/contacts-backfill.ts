/**
 * One-off fills of the CRM from what the workforce and layoff data already
 * knows. The daily cron keeps boards and colleges current afterwards.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/contacts-backfill.ts boards
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/contacts-backfill.ts colleges
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/contacts-backfill.ts chros [limit]
 *
 * chros: for employers promoted from WARN filings that have no HR leader in
 * the CRM yet, reads the company's own leadership pages and asks Claude Haiku
 * 4.5 who heads HR. Metered: about a cent per company. The name must appear
 * on the page it is credited to, and nothing comes from the model's memory.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../src/lib/prisma'
import { addBoardContactsToCrm } from '../../src/lib/workforce/board-crm'
import { addCollegeContactsToCrm } from '../../src/lib/workforce/college-crm'
import { addContactToCrm } from '../../src/lib/crm/add-contact'
import { buildChroRequest, readLeadershipPages, verifiedChro } from '../../src/lib/crm/chro-finder'
import { isHrLeaderTitle, lookupDomain, receivesMail } from '../../src/lib/crm/org-domains'
import { siteDomain } from '../../src/lib/workforce/college-rank'
import { getPage, type PageFetcher } from '../../src/lib/workforce/college-pages'
import { goalsForRoles } from '../../src/lib/crm/goals'

/** Chromium, for sites that build their pages with JavaScript or turn away plain requests. */
async function browserFetcher(): Promise<{ fetchPage: PageFetcher; close: () => Promise<void> }> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  })
  const fetchPage: PageFetcher = async (url, timeoutMs = 25_000) => {
    const page = await context.newPage()
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      if (!res || res.status() >= 400) return null
      await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {})
      return { html: await page.content(), url: page.url() }
    } catch { return null } finally { await page.close().catch(() => {}) }
  }
  return { fetchPage, close: () => browser.close() }
}

/** A domain guessed from the company's name, kept only when its home page names the company and it receives mail. */
async function guessSite(name: string): Promise<string | null> {
  const base = name.replace(/\b(inc|llc|corp|corporation|co|company|ltd|plc|holdings|group|technologies)\b\.?/gi, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (base.length < 4) return null
  for (const tld of ['com']) {
    const domain = `${base}.${tld}`
    if (!(await receivesMail(domain))) continue
    const home = await getPage(`https://www.${domain}/`)
    const title = home?.html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ''
    if (home && title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(base)) return `https://www.${domain}/`
  }
  return null
}

async function chros(limit: number) {
  const claude = new Anthropic()
  const promoted = await prisma.warnNotice.groupBy({ by: ['promotedOrgId'], where: { promotedOrgId: { not: null } }, _sum: { employees: true } })
  const withHr = new Set(
    (await prisma.crmAffiliation.findMany({
      where: { isCurrent: true, person: { deletedAt: null } },
      select: { orgId: true, title: true },
    })).filter((a) => isHrLeaderTitle(a.title)).map((a) => a.orgId),
  )
  const ids = promoted.filter((p) => !withHr.has(p.promotedOrgId!))
    .sort((a, b) => (b._sum.employees ?? 0) - (a._sum.employees ?? 0))
    .slice(0, limit).map((p) => p.promotedOrgId!)
  const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: ids } } })
  const order = new Map(ids.map((id, i) => [id, i]))
  orgs.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  console.log(`${orgs.length} employers to look up`)

  const browser = process.env.CHRO_BROWSER === '0' ? null : await browserFetcher()
  const tally = { found: 0, noSite: 0, noPages: 0, noAnswer: 0, added: 0, matched: 0, review: 0, removed: 0 }
  const queue = [...orgs]
  const worker = async () => {
    for (let org = queue.shift(); org; org = queue.shift()) {
      // The company's home page, not whatever page its website field points at.
      const root = siteDomain(org.website)
      let site: string | null = root ? `https://www.${root}/` : null
      if (!site && org.emailDomain) site = `https://www.${org.emailDomain}/`
      if (!site) {
        const d = await lookupDomain(org.name).catch(() => null)
        if (d && (await receivesMail(d))) site = `https://www.${d}/`
      }
      if (!site) site = await guessSite(org.name).catch(() => null)
      if (!site) { tally.noSite++; continue }
      let pages = await readLeadershipPages(site).catch(() => [])
      if (!pages.length && browser) pages = await readLeadershipPages(site, browser.fetchPage).catch(() => [])
      if (!pages.length) { tally.noPages++; continue }
      const msg = await claude.messages.create(buildChroRequest(org.name, pages)).catch(() => null)
      const raw = msg?.content.find((b) => b.type === 'text')?.text ?? ''
      const found = verifiedChro(raw, pages)
      if (!found) { tally.noAnswer++; continue }
      tally.found++
      console.log(`${org.name}: ${found.name}, ${found.title}`)
      const roles = ['HIRING_MANAGER' as const]
      const r = await addContactToCrm({
        fullName: found.name, title: found.title, email: null, linkedinUrl: found.linkedinUrl,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
        note: `${found.title} at ${org.name}, which has filed a WARN layoff notice. From the company's own website: ${found.sourceUrl}`,
      })
      if (r.outcome === 'removed') { tally.removed++; continue }
      tally[r.outcome]++
      if (org.companyId) {
        await prisma.company.updateMany({
          where: { id: org.companyId, chroName: null },
          data: { chroName: found.name, chroLinkedinUrl: found.linkedinUrl },
        })
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  await browser?.close()
  console.log(tally)
}

async function main() {
  const [cmd, arg] = process.argv.slice(2)
  if (cmd === 'boards') console.log(await addBoardContactsToCrm(30 * 60_000))
  else if (cmd === 'colleges') console.log(await addCollegeContactsToCrm(30 * 60_000))
  else if (cmd === 'chros') await chros(Number(arg ?? 40))
  else console.log('usage: boards | colleges | chros [limit]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
