/**
 * Gives every cold-email recipient organization (American Job Center, workforce board, college, economic development group, career-development group, or any other recipient) the CRM organization record its
 * /prepared/<slug> claim page needs. Reads the merge file written by outreach-data.ts; creates records only for rows with no page.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/ensure-claim-orgs.ts <merge.csv>           (dry run, writes nothing)
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/ensure-claim-orgs.ts <merge.csv> --apply   (creates the records)
 *
 * Never guesses: a name that reads the same as another recipient's name (two centers called "Career Center"), or that cannot make a safe
 * page address, is skipped and listed. No email domain is stored, so every claim of a created page goes to a person for review.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { claimSlug } from '../../src/lib/org-claims/urls'

const file = process.argv[2]
const apply = process.argv.includes('--apply')
if (!file) { console.error('usage: ensure-claim-orgs.ts <merge.csv> [--apply]'); process.exit(1) }

/** A small CSV reader: quoted fields may hold commas, doubled quotes and newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const head = rows[0]
  return rows.slice(1).filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}
const decode = (s: string) => s.replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;/gi, "'").trim()

async function main() {
  const rows = parseCsv(readFileSync(file, 'utf8')).filter((r) => !!r.template && !r.claim_url)
  // One entry per distinct recipient name, remembering which kind it is.
  const wanted = new Map<string, { name: string; kind: string }>()
  for (const r of rows) { const name = decode(r.recipient_org); if (name && !wanted.has(`${r.template}|${name}`)) wanted.set(`${r.template}|${name}`, { name, kind: r.template }) }

  const existing = new Set((await prisma.crmOrganization.findMany({ select: { canonicalNameNormalized: true } })).map((o) => o.canonicalNameNormalized))
  const [ajcs, boards, colleges, leads] = await Promise.all([
    prisma.americanJobCenter.findMany({ select: { name: true, state: true, city: true } }),
    prisma.workforceBoard.findMany({ select: { name: true, state: true, website: true } }),
    prisma.collegeProfile.findMany({ select: { name: true, state: true, city: true, website: true } }),
    prisma.geoOrgLead.findMany({ select: { name: true, state: true } }),
  ])
  const place = (kind: string, name: string) => {
    if (kind === 'ajc') { const a = ajcs.filter((x) => decode(x.name) === name); return a.length === 1 ? { state: a[0].state, city: a[0].city, website: null } : { state: a[0]?.state ?? null, city: null, website: null } }
    if (kind === 'board') { const b = boards.filter((x) => decode(x.name) === name)[0]; return { state: b?.state ?? null, city: null, website: b?.website ?? null } }
    if (kind === 'edo' || kind === 'career_dev') { const l = leads.find((x) => decode(x.name) === name); return { state: l?.state ?? null, city: null, website: null } }
    const c = colleges.filter((x) => decode(x.name) === name)[0]; return { state: c?.state ?? null, city: c?.city ?? null, website: c?.website ?? null }
  }

  // A canonical name wanted by two different recipients is ambiguous: neither gets a record.
  const byCanon = new Map<string, string[]>()
  for (const w of wanted.values()) { const c = normalizeOrgName(w.name); byCanon.set(c, [...(byCanon.get(c) ?? []), w.name]) }

  const skipped: { name: string; why: string }[] = []
  const toCreate: { name: string; canon: string; kind: string }[] = []
  for (const w of wanted.values()) {
    const canon = normalizeOrgName(w.name)
    if (existing.has(canon)) { skipped.push({ name: w.name, why: 'a record with this name already exists, so the recipient already has a page (names with an ampersand now get one)' }); continue }
    if ((byCanon.get(canon) ?? []).length > 1) { skipped.push({ name: w.name, why: 'another recipient has a name that reads the same' }); continue }
    if (!claimSlug(canon)) { skipped.push({ name: w.name, why: 'name cannot make a safe page address' }); continue }
    toCreate.push({ name: w.name, canon, kind: w.kind })
  }

  console.log(`${wanted.size} recipient organizations without a page: ${toCreate.length} to create, ${skipped.length} skipped`)
  for (const s of skipped) console.log(`  skip: ${s.name} (${s.why})`)
  if (!apply) { console.log('dry run: nothing written. Add --apply to create the records.'); return }

  let made = 0
  for (const t of toCreate) {
    const p = place(t.kind, t.name)
    await prisma.crmOrganization.create({
      data: {
        name: t.name, canonicalNameNormalized: t.canon, orgTypes: [t.kind === 'college' ? 'UNIVERSITY' : t.kind === 'ajc' || t.kind === 'board' ? 'GOVERNMENT' : 'OTHER'],
        website: p.website, hqCity: p.city, hqRegion: p.state, usState: p.state,
      },
    })
    made++
  }
  console.log(`created ${made} organizations`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
