/**
 * Merges specific CRM organization pairs that a person (Claude, with the owner's go-ahead, 2026-10-26) reviewed and
 * judged to be the same organization. Used after scripts/crm/merge-ampersand-dupes.ts left these out:
 *
 *  - both records carry an investor profile, which mergeOrganizations refuses to choose between. The two profiles are
 *    folded into the survivor's first (every value kept: a blank is filled from the other record, two different notes are
 *    joined, the check-size range is widened, lists are unioned), then the merge runs;
 *  - the records differ on state or website only because of where each was found (a federal agency named in a state's
 *    funding statement; a campus in a second state).
 *
 * DRY RUN BY DEFAULT.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/merge-reviewed-pairs.ts --out <dir>
 *   ... --apply     back up both organizations and both investor profiles of every pair to <dir>/backup.json, then merge
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './merge-reviewed-out'

const PAIRS: { label: string; keep: string; source: string }[] = [
  { label: 'Delaware Department of Labor, Division of Employment and Training', keep: 'cmvlvatly00r0q25tzogzlb66', source: 'cmvkzrop6006kq2yjzna1lj2j' },
  { label: 'National Institute of Standards and Technology', keep: 'cmtx1o6zv001lq2bmslt8nx5l', source: 'cmvl00tj9005aq2c6zopfuano' },
  { label: 'United Way of Greater Milwaukee and Waukesha County', keep: 'cmvkzxmm8003uq29sq8d9xlga', source: 'cmvlbo572005bq2c8u8pc1anc' },
  { label: 'U.S. Department of Labor, Employment and Training Administration', keep: 'cmvkzzysx001eq2c650i3dh35', source: 'cmvlvaxoe00rjq25tbh7vpw5h' },
  { label: 'Spartan College of Aeronautics and Technology', keep: 'cmvpn0vzx007gq2lgmyausvu4', source: 'cmvpnxi3u00s0q2lgo465y9cp' },
  { label: 'Meta (Meta Platforms)', keep: 'cmtx1o84r00y8q2bm4yltxe2v', source: 'cmvoa9agm008tq284dcnh3p01' },
]

async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      const code = (e as { code?: string }).code
      if (i >= tries || (code !== 'P1017' && code !== 'P1001' && code !== 'P2024')) throw e
      await prisma.$disconnect().catch(() => {})
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

const joinText = (a: string | null, b: string | null) => (a && b && a.trim() !== b.trim() ? `${a} | ${b}` : a ?? b)
const union = <T>(a: T[], b: T[]) => [...new Set([...a, ...b])]

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.crmInvestorProfile.findUnique>>>

function foldProfile(keep: Profile, source: Profile) {
  const min = [keep.checkSizeMinUsd, source.checkSizeMinUsd].filter((n): n is number => n != null)
  const max = [keep.checkSizeMaxUsd, source.checkSizeMaxUsd].filter((n): n is number => n != null)
  return {
    checkSizeMinUsd: min.length ? Math.min(...min) : null,
    checkSizeMaxUsd: max.length ? Math.max(...max) : null,
    checkSizeNote: joinText(keep.checkSizeNote, source.checkSizeNote),
    funderKind: keep.funderKind ?? source.funderKind,
    valueTypes: union(keep.valueTypes, source.valueTypes),
    preconditions: joinText(keep.preconditions, source.preconditions),
    preconditionLeadTimeDays: keep.preconditionLeadTimeDays ?? source.preconditionLeadTimeDays,
    stageFocus: union(keep.stageFocus, source.stageFocus),
    thesis: joinText(keep.thesis, source.thesis),
    leadsRounds: keep.leadsRounds ?? source.leadsRounds,
    responsiveness: keep.responsiveness ?? source.responsiveness,
    eligibility: keep.eligibility !== 'UNKNOWN' ? keep.eligibility : source.eligibility,
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const ids = PAIRS.flatMap((p) => [p.keep, p.source])
  const orgs = await retry(() => prisma.crmOrganization.findMany({ where: { id: { in: ids } } }))
  const profiles = await retry(() => prisma.crmInvestorProfile.findMany({ where: { orgId: { in: ids } } }))
  const orgById = new Map(orgs.map((o) => [o.id, o]))
  const profileById = new Map(profiles.map((p) => [p.orgId, p]))
  for (const p of PAIRS) {
    const k = orgById.get(p.keep), s = orgById.get(p.source)
    console.log(`${p.label}: keep ${k ? `"${k.name}"` : 'MISSING'}, merge ${s ? `"${s.name}"` : 'MISSING (already merged?)'}; profiles keep=${profileById.has(p.keep)} source=${profileById.has(p.source)}`)
  }
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  writeFileSync(`${OUT}/backup.json`, JSON.stringify({ takenAt: new Date().toISOString(), organizations: orgs, investorProfiles: profiles }, null, 2))
  console.log(`backed up ${orgs.length} organizations and ${profiles.length} investor profiles to ${OUT}/backup.json`)

  const log: unknown[] = []
  for (const p of PAIRS) {
    if (!orgById.has(p.keep) || !orgById.has(p.source)) { log.push({ ...p, skipped: 'one record is gone' }); continue }
    const kp = profileById.get(p.keep), sp = profileById.get(p.source)
    if (kp && sp) {
      const folded = foldProfile(kp, sp)
      await retry(() => prisma.$transaction([
        prisma.crmInvestorProfile.update({ where: { orgId: p.keep }, data: folded }),
        prisma.crmInvestorProfile.delete({ where: { orgId: p.source } }),
      ]))
      console.log(`  folded the two investor profiles for ${p.label}`)
    }
    const r = await retry(() => mergeOrganizations(p.keep, p.source, 'merge-reviewed-pairs'))
      .catch((e: Error) => ({ ok: false as const, reason: `error: ${String(e.message).split('\n').filter(Boolean).slice(-2).join(' ')}` }))
    log.push({ ...p, ...r })
    console.log(`  ${r.ok ? 'merged' : 'NOT merged'}: ${p.label}${r.ok ? '' : ` (${r.reason})`}`)
    writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
  }
  writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
}

main().finally(() => prisma.$disconnect())
