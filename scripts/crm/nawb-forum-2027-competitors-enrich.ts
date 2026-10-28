/**
 * Full website read for the NAWB Forum 2027 competitor cards (same steps as the Competitors page
 * "paste a website": read the site, merge into the card, add product gaps and CRM wins). The
 * download email is left out. Cost is about $0.10 a card, recorded in CompetitorWatchRun.
 *
 *   RESEND_API_KEY= HUNTER_API_KEY= npx tsx --conditions=react-server --env-file=.env.local scripts/crm/nawb-forum-2027-competitors-enrich.ts
 */
import { prisma } from '../../src/lib/prisma'
import { enrichCompetitor } from '../../src/lib/vision/competitor-enrich'
import { mergeRefresh } from '../../src/lib/vision/competitor-watch'
import { syncProductGaps, syncCrmWins } from '../../src/lib/vision/competitor-sync'

const SITES: Record<string, string> = {
  'Job Machine': 'https://jobmachine.com',
  'Julius Education': 'https://juliuseducation.com',
  'Fit First Technologies': 'https://fitfirsttech.com',
  'Alliance Enterprises': 'https://www.allianceenterprises.com',
  'Apprentos': 'https://www.apprentos.com',
  'Public Consulting Group': 'https://publicconsultinggroup.com',
}

async function main() {
  let total = 0
  for (const [name, url] of Object.entries(SITES)) {
    const c = await prisma.productCompetitor.findFirst({ where: { name } })
    if (!c) { console.log('missing card', name); continue }
    try {
      const { data: e, cost, searches } = await enrichCompetitor(url, c.positioning ?? undefined)
      const m = mergeRefresh({ ...c, filledBy: 'website' }, e)
      const updated = await prisma.productCompetitor.update({
        where: { id: c.id },
        data: { ...m, url, filledBy: 'website', notes: [c.notes, e.notes].filter(Boolean).join('\n\n') || null },
      })
      await prisma.competitorWatchRun.create({ data: { competitorId: c.id, kind: 'refresh', costUsd: cost, searches, ok: true } })
      const ideas = await syncProductGaps(updated).catch(() => 0)
      const wins = await syncCrmWins([updated]).catch(() => 0)
      total += cost
      console.log(name, { rel: updated.relationship, ideas, crmWins: wins, cost: +cost.toFixed(3) })
    } catch (err) {
      console.log(name, 'FAILED', err instanceof Error ? err.message : err)
    }
  }
  console.log('total cost $' + total.toFixed(2))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
