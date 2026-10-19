/**
 * Merges CRM organizations that are the same company written two ways
 * ("Amazon", "Amazon.com", "Amazon - SF019"), using the rules in
 * src/lib/crm/org-duplicates.ts.
 *
 * DRY RUN BY DEFAULT. Writes a report either way.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/consolidate-duplicate-orgs.ts --out <dir>
 *   ... --apply            merge every group the rules call safe
 *
 * Groups the rules are unsure about are never merged; they are listed in
 * review.json for a person to decide. With --apply the rows about to be deleted
 * are saved to <dir>/backup-orgs.json first, and every merge is logged in
 * <dir>/merge-log.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { classifyGroup, cleanestName, looseKey, websiteMatchesName } from '../../src/lib/crm/org-duplicates'
import { suggestKeeper } from '../../src/lib/duplicates/suggest'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './consolidate-out'

/**
 * Groups a person looked at and decided are different companies, keyed by looseKey.
 * Kept in code so re-running never merges them.
 */
const NOT_DUPLICATES = new Set<string>([])

/** A group containing any of these names is left alone, with the reason shown in review.json. */
const HOLD: Record<string, string> = {
  'The Help Company': 'Different companies: Help USA vs The Help Company.',
  'Deluxe (media services)': 'Deluxe Corp (checks, payments) and Deluxe Media are different companies.',
  'People Inc. (Dotdash Meredith)': 'People Inc., "People" and People.Co look like three different companies.',
  'Self.': 'SELF the loan fund vs a company called Self.',
  'Care USA': 'CARE USA is a member of CARE International; one record or two?',
  'Valley Health System (New Jersey)': 'There are Valley Health Systems in NJ, VA and NV.',
  'Dart': 'Dart vs DART (Dallas Area Rapid Transit).',
  'Everest Group (Everest Re)': 'Everest Group (consulting) and Everest Re (insurance) are different.',
  'EMPLOYERS (Employers Holdings)': '"Employers" is too generic to merge on a name.',
  'The Goddard School of Manhattan (Murray Hill), NY': 'Separate franchise locations.',
  'Trinity Academy': 'Generic school name; the Raleigh one may be a different school.',
  'ONE (Open Network Exchange)': '"One" is too generic to merge on a name.',
  'AGS': '"AGS" is too generic to merge on a name.',
  'Binance US': 'Binance.US is a separate legal entity from Binance.',
  'Smith Inc.': 'Smith Inc. and Smith.ai are different companies.',
  'You.com': 'You.com and "Y.o.u." may be different.',
  'Visit Us': 'Visit Us and Visit.org may be different.',
  'GovernmentJobs.com': 'Government Jobs / GovernmentJobs.com / US Government Jobs: which is which?',
  'Nextpower': 'Nextracker renamed itself Nextpower? Confirm it is one company.',
  'Polaris (formerly Polaris Project)': 'Polaris Project (anti-trafficking nonprofit) and Polaris Inc. (vehicles) are different.',
}
const SPACING = 'Differ only by where the spaces are, and the name is generic enough that they could be two companies.'
for (const n of [
  'Alls Well', 'North Central University', 'Visit Site »', 'Trellis Group', 'Blue Bird, Inc.', 'Health Care Services', 'Braintrust',
  'Office of General Counsel', 'Office of Inspector General', 'Office of State Public Defender', 'Freshpaint', 'TerraFirma', 'Hightouch',
  'Human Capital', 'DataOne', 'Félix',
]) HOLD[n] = SPACING
/** Names left out of their group's merge (the rest still merge). */
const EXCLUDE = new Set<string>([])
/** Groups merged even though the rules would hold them, by one member's name. */
const FORCE_MERGE = new Set([
  'Spirit Airlines', 'KIPP Public Schools Northern California', 'Texana Center (Building A) Airport Service Center',
  'ETH Zurich (Swiss Federal Institute of Technology)',
  'SAP.iO', 'NYU (Endless Frontier Labs)', 'SHRM (SHRMLabs)', 'Massachusetts Institute of Technology (Lincoln Lab)', 'Princeton University (PPPL)',
  'California Institute of Technology (JPL)', 'Carnegie Mellon University (SEI)', 'UC Irvine (incl. UCI Health)',
  'Amazon', 'Walmart', 'MUFG Investor Services (US), LLC', 'National Institutes of Health',
  'The Ladders (Ladders, Inc.)', 'Miami University (Ohio)', 'Omnicom (OMC Group)', 'Zurn Elkay (Elkay Manufacturing)', 'Samsung (US HQ)',
  'Babson College (F.W. Olin Graduate School of Business)', 'Vantor (Maxar Intelligence)', 'Vetter Senior Living (home office)',
  'Police Executive Research Forum (Executive Search)', 'Jobs for the Future (JFFLabs)', 'Abbott (abbottcareers2 board)',
  'Pathstone (merged with Cornerstone Capital Group, 2021)', 'Summit Search Consultants (test)', 'LSEG (London Stock Exchange Group)',
  'Learning Commons (Chan Zuckerberg Initiative)', 'Resource Environmental Solutions ("RES")', 'Weekday AI (YC W21)',
  'United Parks & Resorts (SeaWorld)', 'Nextracker (Nextpower)', 'Aios (Yc W20/S21)', 'MaintainX (An Autodesk Company)',
  'Wounded Warrior Project (Hq)', 'T5 Data Centers (EverOn)', 'EAB (Education Advisory Board)', 'Expert Executive Recruiters (EER Global)',
  'FloWorks International LLC (FloWorks)', 'Ya-Group', 'Seed Health (Biotechnology)', 'TASC, Inc. (Treatment Alternatives for Safe Communities)',
  'Certa (getcerta.com)', 'Net2Source (N2S)', 'HHM Hotels (Philadelphia Corporate)', 'Perseus Operating Group (Constellation Software)',
  'CAMS (Community Association Management Services)', 'SoloPoint Solutions (Wisconsin)', 'Women In Need, Inc. (Win)',
  'East Valley Institute of Technology (District)',
])
/** One-word names so common that "X" and "X.io" are as likely to be two companies; these stay separate unless a website proves it. */
const GENERIC_WORDS = new Set(['apollo'])
/** Further organizations folded into the group of the first name (legal entities that file WARN notices as Amazon). */
const EXTRA_MERGES: string[][] = [
  ['Amazon', 'Amazon Data Services', 'Amazon Technologies', 'Amazon Development Center U.S.', 'Amazon Last Mile',
    'Prime Video & Amazon MGM Studios', 'Amazon Web Services', 'AmazonWebServices'],
  ['Spirit Airlines', 'Spirit Airlines (DFW) May 2026', 'Spirit Airlines (IAH) May 2026'],
]
/** Parents that absorb every organization whose name starts with the prefix (sites, group homes, regional schools). */
const FOLD_PREFIXES: { parent: string; prefix: string }[] = [
  { parent: 'Texana Center', prefix: 'Texana Center ' },
  { parent: 'KIPP Public Schools Northern California', prefix: 'KIPP Public Schools Northern California ' },
]

/** Retries a call when the database connection drops (Prisma P1017 / P1001), which the pooler does now and then. */
async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn() } catch (e) {
      const code = (e as { code?: string }).code
      if (i >= tries || (code !== 'P1017' && code !== 'P1001' && code !== 'P2024')) throw e
      console.log(`  connection dropped (${code}), retry ${i}/${tries - 1}`)
      await prisma.$disconnect().catch(() => {})
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const all = await retry(() => prisma.crmOrganization.findMany({
    select: {
      id: true, name: true, website: true, canonicalNameNormalized: true, companyId: true, hiringClient: true, createdAt: true, orgTypes: true,
      _count: { select: { affiliations: true, opportunities: true, mandates: true } },
    },
  }))
  console.log(`loaded ${all.length} organizations`)

  const groups = new Map<string, typeof all>()
  for (const o of all) {
    const k = looseKey(o.name)
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), o])
  }
  for (const { parent, prefix } of FOLD_PREFIXES) {
    if (all.some((o) => o.name === parent)) EXTRA_MERGES.push([parent, ...all.filter((o) => o.name.startsWith(prefix)).map((o) => o.name)])
  }
  for (const [first, ...rest] of EXTRA_MERGES) {
    const k = looseKey(first)
    const extra = rest.flatMap((n) => all.filter((o) => o.name === n))
    const g = groups.get(k)
    if (g) groups.set(k, [...g, ...extra.filter((e) => !g.includes(e))])
    for (const e of extra) { const ek = looseKey(e.name); if (ek !== k) groups.set(ek, (groups.get(ek) ?? []).filter((o) => o !== e)) }
  }
  for (const [k, g] of groups) groups.set(k, g.filter((o) => !EXCLUDE.has(o.name)))
  const dupes = [...groups.entries()].filter(([k, g]) => g.length > 1 && !NOT_DUPLICATES.has(k))

  type Plan = { key: string; keepId: string; keepName: string; finalName: string; mergeIds: string[]; names: string[]; reason: string }
  const merges: Plan[] = []
  const review: { key: string; names: string[]; reason: string }[] = []
  for (const [key, g] of dupes) {
    const names = g.map((o) => o.name)
    const held = names.find((n) => HOLD[n])
    let d = held ? { action: 'review' as const, reason: HOLD[held] } : classifyGroup(names)
    if (!held && d.action === 'review' && names.some((n) => FORCE_MERGE.has(n))) d = { action: 'merge', reason: 'Confirmed by hand.' }
    if (!held && d.action === 'review' && d.reason.startsWith('One has .com') && !names.some((n) => GENERIC_WORDS.has(looseKey(n)))) {
      d = { action: 'merge', reason: 'Same name with a web address on the end.' }
    }
    // A name written as a web address is the same company when its website is that address.
    if (!held && d.action === 'review' && d.reason.startsWith('One has .com') && g.some((o) => names.some((n) => websiteMatchesName(o.website, n)))) {
      d = { action: 'merge', reason: 'The website is the web address in the name.' }
    }
    if (d.action === 'review') { review.push({ key, names, reason: d.reason }); continue }
    const weight = (o: (typeof g)[number]) => o._count.affiliations + o._count.opportunities + o._count.mandates
    const keeper = suggestKeeper(g.map((o) => ({ id: o.id, activity: weight(o) + (o.hiringClient ? 5 : 0), linked: Boolean(o.companyId), createdAt: o.createdAt })))
    const keep = g.find((o) => o.id === keeper.id)!
    merges.push({ key, keepId: keep.id, keepName: keep.name, finalName: cleanestName(names), mergeIds: g.filter((o) => o.id !== keep.id).map((o) => o.id), names, reason: d.reason })
  }
  const removable = merges.reduce((n, m) => n + m.mergeIds.length, 0)
  console.log(`groups: ${dupes.length}  safe to merge: ${merges.length} (removes ${removable})  needs a person: ${review.length}`)
  writeFileSync(`${OUT}/plan.json`, JSON.stringify(merges, null, 2))
  writeFileSync(`${OUT}/review.json`, JSON.stringify(review, null, 2))
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  const byId = new Map(all.map((o) => [o.id, o]))
  writeFileSync(`${OUT}/backup-orgs.json`, JSON.stringify(merges.flatMap((m) => m.mergeIds.map((id) => byId.get(id))), null, 2))

  const log: unknown[] = []
  let done = 0, refused = 0
  for (const m of merges) {
    for (const id of m.mergeIds) {
      // One bad group must not stop the run: log the error and move on (a failed merge rolls back whole).
      const r = await retry(() => mergeOrganizations(m.keepId, id, 'consolidate-duplicate-orgs'))
        .catch((e: Error) => ({ ok: false as const, reason: `error: ${String(e.message).split('\n').filter(Boolean).slice(-2).join(' ')}` }))
      log.push({ key: m.key, keepId: m.keepId, sourceId: id, sourceName: byId.get(id)?.name, ...r })
      if (r.ok) done++
      else { refused++; console.log(`  not merged: ${byId.get(id)?.name} -> ${m.keepName}: ${r.reason}`) }
      writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
    }
    // Write the cleanest spelling onto the survivor when it differs and the key is free.
    if (m.finalName !== m.keepName) {
      const { normalizeOrgName } = await import('../../src/lib/text/org-name-match')
      const key = normalizeOrgName(m.finalName)
      const taken = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } })
      if (!taken || taken.id === m.keepId) {
        await prisma.crmOrganization.update({ where: { id: m.keepId }, data: { name: m.finalName, canonicalNameNormalized: key } }).catch((e) => console.log(`  rename failed for ${m.finalName}: ${e.message}`))
      }
    }
    if (done % 50 === 0) console.log(`  ${done} merged`)
  }
  writeFileSync(`${OUT}/merge-log.json`, JSON.stringify(log, null, 2))
  console.log(`merged ${done}, refused ${refused}`)
}

main().finally(() => prisma.$disconnect())
