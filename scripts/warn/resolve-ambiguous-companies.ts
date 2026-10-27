/**
 * Resolves the WarnNotice rows whose employer loosely matched several companies (companyMatchStatus AMBIGUOUS).
 * Each employer name is decided by, in order: a reviewed ruling below (employer pattern -> the company it is), the whole-word rules in
 * src/lib/warn/ambiguous-resolve.ts, or a new company when the loose match was only a substring ("Meta" in "Metallics"). A name nothing
 * can decide stays AMBIGUOUS.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/resolve-ambiguous-companies.ts --out <dir> [--apply]
 * With --apply the rows about to change are saved to <dir>/backup-ambiguous.json first.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { Prisma, PrismaClient } from '@prisma/client'
import { resolveAmbiguous } from '../../src/lib/warn/ambiguous-resolve'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const out = args[args.indexOf('--out') + 1]

/** Reviewed 2026-10-27: an employer pattern and the company record it is (by exact company name). */
const RULINGS: [RegExp, string][] = [
  [/^saks (&amp;|&) company/i, 'Saks & Company LLC'],
  [/bahama breeze/i, 'GMRI, Inc. dba Bahama Breeze'],
  [/^oracle /i, 'Oracle'],
  [/^kaiser foundation/i, 'Kaiser'],
  [/^amentum /i, 'Amentum'],
  [/^emerson /i, 'Emerson'],
  [/^conduent/i, 'Conduent'],
  [/good samaritan society/i, 'Good Samaritan Society'],
  [/^intel corporation/i, 'Intel Corporation'],
  [/^prudential insurance/i, 'Prudential'],
  [/^leidos/i, 'Leidos'],
  [/^shell recharge/i, 'Shell'],
  [/^ryder$/i, 'Ryder Systems Inc.'],
  [/^gerresheimer/i, 'Gerresheimer'],
  [/^applegreen$/i, 'Applegreen US'],
  [/^evernorth/i, 'Evernorth'],
  [/^buzzfeed/i, 'BuzzFeed'],
  [/^chartwells/i, 'Compass Group, Inc.d.b.a.Chartwells'],
  [/^sumitomo mitsui banking/i, 'SMBC-Sumitomo Mitsui Banking Corporation'],
  [/^natural foods/i, 'United Natural Foods, Inc.'],
  [/^oak view group/i, 'Oak View Group at McCormick Place'],
  [/^respironics/i, 'Philips Respironics, Inc.'],
  [/^amazon ?fresh/i, 'Amazon'],
  [/^bush industries/i, 'Bush Industries Inc. d/b/a eSolutions Group'],
  [/^geodis/i, 'Geodis'],
  [/^kidspeace/i, 'KidsPeace'],
  [/^essendant/i, 'Essendant Co.'],
  [/^republic national distributing/i, 'Republic National Distributing Company LLC'],
  [/^zenimax/i, 'ZeniMax Media Inc.'],
  [/^kroger fulfillment/i, 'Kroger'],
  [/^tiktok/i, 'Tiktok'],
  [/^meta platforms/i, 'Meta'],
  [/^sambanova/i, 'SambaNova'],
  [/^nordstrom credit/i, 'Nordstrom Credit, Inc.'],
  [/^battelle/i, 'Battelle'],
  [/^ideal us talent/i, 'Ideal US Talent Systems Worker OpCo LLC'],
  [/^sodexo/i, 'Sodexo'],
  [/shiloh industries|^grouper acquisition/i, 'Grouper Acquisition Company, LLC, dba Shiloh Industries, Inc'],
  [/^parkdale/i, 'Parkdale'],
  [/^jeniusbank smbc/i, 'SMBC Manubank'],
  [/^evergreen recycling/i, 'Ultrepet, LLC. d/b/a Evergreen Recycling, LLC.'],
  [/^cayuga/i, 'Cayuga Home for Children, dba Cayuga Centers 3081 E Commercial BLVD STE 202 & 204 FORT LAUDERDALE, FL, 33308'],
  [/^labcorp/i, 'Laboratory Corporation of America'],
  [/^dana thermal/i, 'Dana Incorporated'],
  [/^dp world/i, 'DP World'],
  [/^salon ?centric/i, 'Salon Centric Inc'],
  [/^lacroix/i, 'Lacroix'],
  [/^pca \(/i, 'Packaging Corporation of America'],
  [/^compass group$/i, 'Compass Group USA, Inc.'],
  [/^cenlar/i, 'Cenlar FSB'],
  [/^ftgu/i, 'Powered by FTGU, LLC'],
  [/^formagrid/i, 'Airtable'],
  [/^fender/i, 'Fender'],
  [/^\*rescinded\* hendall/i, 'Hendall Inc.'],
  [/^waddington/i, 'Novolex'],
  [/^costar/i, 'CoStar'],
  [/^ensco/i, 'Ensco'],
  [/^albertsons/i, 'Albertsons'],
  [/^constellium/i, 'Constellium'],
  [/^atkore/i, 'Atkore'],
  [/^moove/i, 'Moove'],
  [/^kipp atlanta/i, 'Kipp'],
  [/^freight handlers/i, 'Freight Handlers, LLC (FHI) 2600 County Line Road LAKELAND, FL, 33811'],
  [/^qb intermediate/i, 'Quality Built LLC'],
  [/^congo brands/i, 'Congo, LLC'],
  [/^martinrea/i, 'Martinrea'],
  [/^ruan transport/i, 'Ruan Transportation Management Systems'],
  [/^kellanova/i, 'Kellanova'],
  [/^pepsico/i, 'PepsiCo'],
  [/bartell drug/i, 'Rite-Aid'],
  [/^80 acres/i, '80 Acres Farms'],
  [/^mv transportation/i, 'MV Transportation, Inc. 8300 Radio Road NAPLES, FL, 34104'],
  [/^vimeo/i, 'Vimeo'],
  [/^accelerate ?360 dist/i, 'Accelerate360 Distribution, LLC'],
  [/^trans ?axle/i, 'Trans Axle'],
  [/^amazonfresh/i, 'Amazon'],
  [/^amazon-/i, 'Amazon'],
  [/^peraton/i, ''], // a new company: the one record, "Peraton Balloon Operations", is a different unit
]

/** A new company's name: the employer without a site, address or filing note. */
function cleanName(raw: string): string {
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/^\s*(\*[^*]*\*|update[d]?\s*[-–:]?)\s*/i, '')
    .replace(/\s+[-–—]\s+.*$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+total warn:?\s*$/i, '')
    .trim() || raw
}

async function main() {
  const rows = await prisma.warnNotice.findMany({
    where: { companyMatchStatus: 'AMBIGUOUS', dismissedAt: null },
    select: { id: true, employer: true, companyId: true, companyMatchStatus: true, companyMatchCandidates: true },
  })
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  const byName = new Map(companies.map((c) => [c.name, c.id]))
  const live = new Set(companies.map((c) => c.id))
  const stale: string[] = []
  const plan: { id: string; employer: string; to: string | null; how: string; name?: string }[] = []
  const left: string[] = []
  for (const r of rows) {
    const cands = (r.companyMatchCandidates as { id: string; name: string }[] | null) ?? []
    const ruling = RULINGS.find(([re]) => re.test(r.employer))
    let to: string | null = null
    let how = ''
    if (ruling) {
      if (ruling[1] === '') { how = 'new' } else {
        const id = byName.get(ruling[1])
        if (!id) { left.push(`${r.employer} (ruling target missing: ${ruling[1]})`); continue }
        to = id; how = 'ruling'
      }
    } else {
      const res = resolveAmbiguous(r.employer, cands)
      if (res.kind === 'match') {
        // The candidate list is a snapshot; a company merged since then no longer exists. Look it up by name, else decide again as new.
        const id = live.has(res.id) ? res.id : byName.get(res.name)
        if (id) { to = id; how = 'rule' } else { stale.push(`${r.employer} -> ${res.name}`); how = 'new-default' }
      } else if (res.kind === 'new') how = 'new'
      else { how = 'new-default' }
    }
    plan.push({ id: r.id, employer: r.employer, to, how, name: how.startsWith('new') ? cleanName(r.employer) : undefined })
  }
  const count = (h: string) => plan.filter((p) => p.how === h).length
  console.log({ rows: rows.length, ruling: count('ruling'), rule: count('rule'), new: count('new'), newDefault: count('new-default'), left: left.length })
  console.log('stale candidates:', stale)
  console.log('new-default sample:', plan.filter((p) => p.how === 'new-default').map((p) => p.employer).slice(0, 80))
  if (left.length) console.log(left)
  if (!apply) return
  if (!out) throw new Error('--out <dir> required with --apply')
  mkdirSync(out, { recursive: true })
  writeFileSync(`${out}/backup-ambiguous.json`, JSON.stringify(rows, null, 1))
  let done = 0
  for (const p of plan) {
    let companyId = p.to
    if (!companyId) {
      const name = p.name!
      const canonicalNameNormalized = normalizeOrgName(name)
      const c = await prisma.company.upsert({ where: { canonicalNameNormalized }, update: {}, create: { name, canonicalNameNormalized }, select: { id: true } })
      companyId = c.id
    }
    await prisma.warnNotice.update({ where: { id: p.id }, data: { companyId, companyMatchStatus: 'MATCHED', companyMatchCandidates: Prisma.DbNull } })
    done++
  }
  console.log('applied', done)
}
main().finally(() => prisma.$disconnect())
