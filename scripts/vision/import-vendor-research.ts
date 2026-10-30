/**
 * Files the 2026-10-30 NAWDP vendor-marketplace research onto the Competitors page and turns the revenue notes we
 * already hold into a number the table can sort on.
 *
 *   npx tsx --env-file=.env.local scripts/vision/import-vendor-research.ts            dry run
 *   npx tsx --env-file=.env.local scripts/vision/import-vendor-research.ts --commit
 *
 * Source: data/competitor-research/2026-10-30/vendors_*.json (web reads; every figure carries its source in the note).
 * An existing card is only topped up where a field is empty, never overwritten. New cards are drafts (needsReview).
 * The revenue backfill takes the first dollar figure in an existing note and skips ranges, so a conflicting or vague
 * note leaves the number empty rather than guessing; the note itself is never changed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { cleanAreas, cleanRelationship, firstDollarFigure, parseLines } from '../../src/lib/vision/competitor-areas'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = join(__dirname, '../../data/competitor-research/2026-10-30')

/** Research name -> the name already on the page. */
const EXISTING: Record<string, string> = {
  Lightcast: 'Lightcast (Emsi Burning Glass)',
  'Geographic Solutions': 'Geographic Solutions',
  'Career.io': 'Career.io',
  myOneFlow: 'myOneFlow',
  'Job Machine': 'Job Machine',
  Indeed: 'Indeed',
  CareerOneStop: 'CareerOneStop',
  'FutureFit AI': 'FutureFit AI',
  'WIN Learning (WIN Career Readiness)': 'WIN Learning',
}
/** New cards: the name shown, and the market (a key from CATEGORIES). */
const NEW: Record<string, { name: string; category: string }> = {
  EconoVue: { name: 'EconoVue', category: 'workforce_gov' },
  Hardly: { name: 'Hardly', category: 'workforce_gov' },
  SendCarrot: { name: 'SendCarrot', category: 'workforce_gov' },
  'Military Transition University': { name: 'Military Transition University', category: 'coaching' },
  'Foundation for Talent Transformation (F4TT)': { name: 'Foundation for Talent Transformation (F4TT)', category: 'assessments' },
  'Career TEAM': { name: 'Career TEAM', category: 'workforce_gov' },
  'ed2go (Cengage Work)': { name: 'ed2go (Cengage Work)', category: 'retraining' },
  'Metrix Learning (a Certus company)': { name: 'Metrix Learning', category: 'workforce_gov' },
  MedCerts: { name: 'MedCerts', category: 'retraining' },
  Transfr: { name: 'Transfr', category: 'retraining' },
  'ACT (WorkKeys / ACT Workforce Solutions)': { name: 'ACT (WorkKeys)', category: 'assessments' },
  'EdITS (COPSystem)': { name: 'EdITS (COPSystem)', category: 'assessments' },
  'Untapped Solutions': { name: 'Untapped Solutions', category: 'workforce_gov' },
}
/** ACT's Similarweb figure is labelled "last 3 months"; every other traffic figure here was divided to a month, so this one is too. */
const TRAFFIC_OVERRIDE: Record<string, { monthlyVisits: number; trafficNote: string }> = {
  'ACT (WorkKeys / ACT Workforce Solutions)': { monthlyVisits: 1_233_000, trafficNote: 'Similarweb Sep 2026 shows 3.7M labelled "last 3 months"; about 1.2M a month if that is a 3-month total. Mostly admissions-test traffic. Estimate.' },
}

type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const s = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null)

async function main() {
  const rows: R[] = readdirSync(DIR).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
  console.log(COMMIT ? 'COMMIT' : 'DRY RUN', rows.length, 'researched companies')

  for (const r of rows) {
    const ov = TRAFFIC_OVERRIDE[r.name]
    const traffic = ov ?? { monthlyVisits: n(r.monthlyVisits), trafficNote: s(r.trafficNote, 400) }
    const revenueNote = s(r.revenueNote, 400)
    const existingName = EXISTING[r.name]
    if (existingName) {
      const c = await prisma.productCompetitor.findUnique({ where: { name: existingName } })
      if (!c) { console.log('MISSING existing card', existingName); continue }
      const data: R = {}
      if (c.revenueUsd == null && n(r.revenueUsd)) data.revenueUsd = n(r.revenueUsd)
      if (!c.revenueNote && revenueNote && n(r.revenueUsd)) data.revenueNote = revenueNote
      if (c.monthlyVisits == null && traffic.monthlyVisits) { data.monthlyVisits = traffic.monthlyVisits; data.trafficNote = traffic.trafficNote }
      if (c.headcount == null && n(r.headcount)) data.headcount = n(r.headcount)
      if (!c.pricingNote && s(r.pricingNote, 300)) data.pricingNote = s(r.pricingNote, 300)
      if (!c.foundedYear && n(r.foundedYear)) data.foundedYear = n(r.foundedYear)
      if (!c.hq && s(r.hq, 80)) data.hq = s(r.hq, 80)
      if (n(r.headcount) && c.headcount && n(r.headcount) !== c.headcount) console.log(`  conflict: ${existingName} headcount card=${c.headcount} research=${r.headcount} (kept card)`)
      console.log('TOP UP', existingName.padEnd(34), Object.keys(data).join(', ') || '(nothing new)')
      if (COMMIT && Object.keys(data).length) await prisma.productCompetitor.update({ where: { id: c.id }, data })
      continue
    }
    const nw = NEW[r.name]
    if (!nw) { console.log('UNMAPPED', r.name); continue }
    if (await prisma.productCompetitor.findUnique({ where: { name: nw.name } })) { console.log('SKIP (already there)', nw.name); continue }
    const noteBits = [s(r.ownership, 200) && `Ownership: ${s(r.ownership, 200)}`, s(r.notes, 600), r.confidence && `Research confidence: ${r.confidence} (read 2026-10-30)`].filter(Boolean).join('\n')
    const closing = /shutting down|shut down/i.test(`${r.notes ?? ''} ${r.positioning ?? ''}`)
    const data = {
      name: nw.name,
      url: s(r.url, 200),
      positioning: s(r.positioning, 800),
      relationship: cleanRelationship(r.relationship),
      areas: cleanAreas(r.areas),
      keyFeatures: parseLines(r.keyFeatures, 15),
      weWin: parseLines(r.weWin, 8), theyWin: parseLines(r.theyWin, 8), weNeed: parseLines(r.weNeed, 8),
      partnerIdea: s(r.partnerIdea, 300),
      pricingNote: s(r.pricingNote, 300), foundedYear: n(r.foundedYear), hq: s(r.hq, 80), lastRound: s(r.lastRound, 160), investors: s(r.investors, 200),
      headcount: n(r.headcount), revenueUsd: n(r.revenueUsd), revenueNote: n(r.revenueUsd) ? revenueNote : null,
      monthlyVisits: traffic.monthlyVisits, trafficNote: traffic.monthlyVisits ? traffic.trafficNote : null,
      userCountNote: s(r.headcountSource, 160),
      sourceUrl: Array.isArray(r.sourceUrls) ? s(r.sourceUrls[0], 300) : null,
      category: nw.category,
      notes: noteBits || null,
      status: 'ACTIVE', statusNote: closing ? 'Winding down: accounts close Dec 15, 2026, so its customers need a new home.' : null,
      filledBy: 'website', needsReview: true, lastReviewedAt: new Date(),
    }
    console.log('NEW   ', nw.name.padEnd(34), data.relationship.padEnd(9), nw.category.padEnd(14), `hc=${data.headcount ?? '-'} rev=${data.revenueUsd ?? '-'} vis=${data.monthlyVisits ?? '-'}`)
    if (COMMIT) await prisma.productCompetitor.create({ data })
  }

  // Backfill: revenue notes -> a sortable number.
  const withNote = await prisma.productCompetitor.findMany({ where: { revenueUsd: null, revenueNote: { not: null } }, select: { id: true, name: true, revenueNote: true } })
  let filled = 0, skipped = 0
  for (const c of withNote) {
    const v = firstDollarFigure(c.revenueNote ?? '')
    if (v == null) { skipped++; continue }
    filled++
    if (COMMIT) await prisma.productCompetitor.update({ where: { id: c.id }, data: { revenueUsd: v } })
  }
  console.log(`revenue backfill: ${filled} numbers from notes, ${skipped} notes left blank (range or no dollar figure)`)
  const t = await prisma.productCompetitor.count()
  console.log('total cards', t)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
