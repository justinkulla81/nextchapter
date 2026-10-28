/**
 * Competitor cards for vendors who presented at NAWB Forum 2027 (agenda: nawb.org/the-forum-2027).
 * Hand-filled drafts (no paid website read), flagged for review. Paste a site on the Competitors page
 * to fill one in properly. Skips any name already on the page.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/nawb-forum-2027-competitors.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'

const SEEN = 'Seen as a presenter at NAWB Forum 2027 (April 5-8, 2027, New York)'
const CARDS: { name: string; relationship: 'DIRECT' | 'ADJACENT'; positioning: string; presenter: string; session: string }[] = [
  { name: 'Job Machine', relationship: 'DIRECT', positioning: 'AI placement tool pitched to workforce boards for dislocated workers.', presenter: 'Brandon Tiggs', session: 'Driving 5X placement gains for dislocated workers using AI' },
  { name: 'CareerPath Services', relationship: 'ADJACENT', positioning: 'Career navigation services and tools pitched to workforce boards.', presenter: 'Harpreet Marwah', session: 'From AI Hype to Workforce Impact: Designing Human-Centered Career Navigation' },
  { name: 'Julius Education', relationship: 'ADJACENT', positioning: 'Real-time career pathway data for mission-critical industries.', presenter: 'Shakir Cannon-Moye', session: 'The Jobs Our Data Can’t See: Building Real-Time Career Pathways' },
  { name: 'Fit First Technologies', relationship: 'ADJACENT', positioning: 'Industry talent ecosystem tooling for workforce innovation.', presenter: 'Jan G van der Hoop', session: 'Building an Industry Talent Ecosystem: A Blueprint for Workforce Innovation' },
  { name: 'Alliance Enterprises', relationship: 'ADJACENT', positioning: 'Case management and workforce software; speaks on ethical, human-decision AI.', presenter: 'Michael O’Brien', session: 'Ensuring Human Decision Making for Ethical and Practical Application of AI' },
  { name: 'Apprentos', relationship: 'ADJACENT', positioning: 'Apprenticeship program management for a region.', presenter: 'Chid Liberty', session: 'From Paperwork to Paycheck: One Region, Four Seats, One Apprenticeship' },
  { name: 'JobsFirst', relationship: 'ADJACENT', positioning: 'Human-centered AI for regional workforce ecosystems (check whether product or nonprofit).', presenter: 'Marjorie Parker', session: 'Scaling Local Workforce Infrastructure: Human Centered AI for Regional Ecosystems' },
  { name: 'Public Consulting Group', relationship: 'ADJACENT', positioning: 'Consulting and technology firm that sells workforce services to the same public buyers.', presenter: 'Kim Tesch-Vaught', session: 'The Human Side of Workforce Innovation' },
]

async function main() {
  const apply = process.argv.includes('--apply')
  let made = 0, skipped = 0
  for (const c of CARDS) {
    const exists = await prisma.productCompetitor.findFirst({ where: { name: { equals: c.name, mode: 'insensitive' } }, select: { id: true } })
    if (exists) { skipped++; continue }
    if (apply) await prisma.productCompetitor.create({ data: {
      name: c.name, relationship: c.relationship, positioning: c.positioning, segment: 'Workforce boards',
      notes: `${SEEN}: ${c.presenter}, "${c.session}". Added by hand from the agenda; not yet read from their site.`,
      filledBy: 'hand', needsReview: true, status: 'ACTIVE',
    } })
    made++
  }
  console.log(apply ? 'APPLIED' : 'DRY RUN', { made, skipped })
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
