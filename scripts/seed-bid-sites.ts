// Adds the paid and free bid-notification sites we should register with as CRM organizations, each with a
// "Register" task. Safe to re-run: an organization is found by its normalized name and a task by its sourceRef.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/seed-bid-sites.ts
import { prisma } from '../src/lib/prisma'
import { normalizeOrgName } from '../src/lib/text/org-name-match'

const SITES = [
  { name: 'BidNet Direct', website: 'https://www.bidnetdirect.com', note: 'State and local bid portal that many boards and counties post on. Free to register; paid state subscriptions about $599-$1,999 a year by number of states (a comparison table, confirm with BidNet).' },
  { name: 'DemandStar', website: 'https://www.demandstar.com', note: 'Local and state bid network. Free basic account; county plans from $35 a year, state plans $35-$1,299, nationwide $2,599 (DemandStar pricing page). Bid documents carry a $5 fee unless the buyer subscribes.' },
  { name: 'HigherGov', website: 'https://www.highergov.com', note: 'Federal, state and local opportunities with a free tier. About $500 a year for one user and $2,500 for a team (list prices from review sites; whether state and local data costs extra is unconfirmed).' },
  { name: 'Findrfp', website: 'https://www.findrfp.com', note: 'Bid aggregator across levels of government. Pricing not published where we looked: ask for a quote.' },
  { name: 'Bidprime', website: 'https://www.bidprime.com', note: 'Alerts-first service across state and local sources. Pricing not published: ask for a quote.' },
  { name: 'BidSync (Periscope)', website: 'https://www.periscopeholdings.com/bidsync-pricing', note: 'Cheaper option found: about $55 a month for one region, $105 a month for all U.S. state and local bids, $234 a month adding federal (billed annually; confirm on the vendor page).' },
  { name: 'MyGovWatch', website: 'https://www.mygovwatch.com', note: 'Cheaper option found: low-cost bid alerts; veteran-owned businesses get a discount (2024 press release). Confirm pricing on the vendor page.' },
]

async function main() {
  for (const s of SITES) {
    const key = normalizeOrgName(s.name)
    let org = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key } })
    if (!org) {
      org = await prisma.crmOrganization.create({ data: { name: s.name, canonicalNameNormalized: key, orgTypes: ['VENDOR'], website: s.website, focus: 'Bid and RFP notification service', notes: `We should register here to find workforce-board and agency bids. ${s.note}` } })
      console.log('created org', s.name)
    } else console.log('org exists', s.name)
    const sourceRef = `register-bid-site:${key}`
    if (!(await prisma.crmTask.findUnique({ where: { sourceRef } }))) {
      await prisma.crmTask.create({
        data: { title: `Register with ${s.name} (free account first; compare coverage of the boards we track)`, kind: 'ADMIN', orgId: org.id, dueAt: new Date(Date.now() + 7 * 86_400_000), ownerEmail: 'justin@launchyournextchapter.com', notes: s.note, sourceRef },
      })
      console.log('task', s.name)
    }
  }
}
main().finally(() => prisma.$disconnect())
