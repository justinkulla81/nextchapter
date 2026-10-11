// Builds sample decks to a folder so the layout can be checked by eye.
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/pitch/sample.ts <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { defaultRuleSet } from '../../src/lib/pitch/defaults'
import { buildDeck, type AreaInput } from '../../src/lib/pitch/build'
import { CUSTOMER_TYPES } from '../../src/lib/pitch/types'
import { renderPptx } from '../../src/lib/pitch/pptx'
import { renderPdf } from '../../src/lib/pitch/pdf'

async function main() {
  const out = process.argv[2] ?? '/tmp/pitch-sample'
  mkdirSync(out, { recursive: true })
  const { areas } = JSON.parse(readFileSync(path.join(process.cwd(), 'data/geo/areas.json'), 'utf8'))
  const j = areas.find((a: { fips: string }) => a.fips === '21111')
  const prisma = new PrismaClient()
  const warn = await prisma.warnNotice.findMany({ where: { state: 'KY', county: { contains: 'Jefferson', mode: 'insensitive' }, dismissedAt: null }, orderBy: { employees: { sort: 'desc', nulls: 'last' } }, take: 15, select: { employer: true, employees: true, noticeDate: true, effectiveDate: true, industry: true } })
  const emp = warn.slice(0, 6).map((w) => ({ employer: w.employer, workers: w.employees ?? 0 }))
  const area: AreaInput = {
    id: j.fips, name: j.name, state: j.state, level: j.level, population: j.population, unemploymentRate: j.unemploymentRate, unemploymentRatePrior: j.unemploymentRatePrior,
    unemploymentAsOf: j.unemploymentAsOf, medianHouseholdIncome: j.medianHouseholdIncome, perCapitaIncome: j.perCapitaIncome, whiteCollarShare: j.whiteCollarShare,
    wcUnemploymentEst: j.wcUnemploymentEst, bcUnemploymentEst: j.bcUnemploymentEst, layoffs12mo: warn.reduce((s, w) => s + (w.employees ?? 0), 0), layoffEvents12mo: warn.length, layoffs90d: warn.filter((w) => w.noticeDate && w.noticeDate > new Date(Date.now() - 90 * 864e5)).reduce((s, w) => s + (w.employees ?? 0), 0),
    higherEdCount: j.higherEdCount, higherEd: j.higherEd, dataCenterCount: j.dataCenterCount, dataCenters: j.dataCenters,
    wioaBoards: [{ name: 'KentuckianaWorks', website: 'https://kentuckianaworks.org', directorName: null, directorTitle: null, directorEmail: null }], majorEmployers: emp, initiatives: null, news: [],
  }
  const headshot = 'data:image/jpeg;base64,' + readFileSync(path.join(process.cwd(), 'public/images/team/justin-kulla.jpg')).toString('base64')
  const people = [{ name: 'Justin Kulla', title: 'Founder and CEO', org: 'NextChapter', side: 'us' as const, bio: 'Serial founder with nearly 20 years as an investor, founder and operator in education technology. Founded BusinessBlocks and sold it to AmTrust; CTO of Edgenuity; Partner at TZP Group. MIT MBA, Harvard MPA.' }]
  const orgs: Record<string, string> = { HIGHER_ED: 'University of Louisville', ECON_DEV: 'Louisville Economic Development Alliance', CHAMBER: 'Louisville Chamber of Commerce', WIOA_BOARD: 'KentuckianaWorks', WORKFORCE_NONPROFIT: 'Example Workforce Nonprofit', RECRUITER: '', OUTPLACEMENT_EMPLOYER: 'Example Corp' }
  for (const type of CUSTOMER_TYPES) {
    const generic = type === 'RECRUITER'
    const deck = buildDeck({ rules: defaultRuleSet(type), brand: { orgName: orgs[type], primary: process.env.BRAND_PRIMARY ?? '#2e7d5b', accent: process.env.BRAND_ACCENT ?? '#0b2545' }, area: generic ? null : area, warn, people })
    writeFileSync(path.join(out, `${type}.pptx`), await renderPptx(deck, { headshot }))
    writeFileSync(path.join(out, `${type}.pdf`), await renderPdf(deck, { headshot }))
    const main = deck.slides.filter((x) => !x.appendix).length
    console.log(type.padEnd(22), String(deck.slides.length).padStart(2), 'slides (', main, 'main +', deck.slides.length - main, 'appendix ),', deck.warnings.length, 'warnings')
  }
  await prisma.$disconnect()
}
main()
