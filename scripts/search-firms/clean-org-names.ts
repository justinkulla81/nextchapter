/**
 * Strips scraped page text out of CRM organization names (and the linked SearchFirm names). Dry run unless --apply.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/search-firms/clean-org-names.ts [--apply]
 * A name is cleaned only when it contains a known scrape marker; the clean name is the text before it. If another
 * organization already has the clean name, the scraped row is a duplicate and is merged into it with mergeOrganizations.
 */
import { prisma } from '../../src/lib/prisma'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const MARKERS = [/\s*\.material-icons\b/, /<\/title>/i, /<meta\b/i, /\s+of [A-Z][A-Za-z .]+, [A-Z]{2}\s*$/]

function cleanName(raw: string): string | null {
  let s = raw
  const i = s.search(/<\/title>|<meta\b|\s\.material-icons\b/i)
  if (i < 0) return null
  s = s.slice(0, i)
  s = s.replace(/\s+of [A-Z][A-Za-z .]+, [A-Z]{2}\s*$/, '').trim()
  return s.length >= 2 && s.length <= 120 ? s : null
}

async function main() {
  const apply = process.argv.includes('--apply')
  void MARKERS
  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(`SELECT id, name FROM "CrmOrganization" WHERE length(name) > 120 OR name ~* '</title>|<meta |\\.material-icons'`)
  for (const r of rows) {
    const clean = cleanName(r.name)
    if (!clean) { console.log(`skip (no scrape marker): ${r.name.slice(0, 60)}`); continue }
    const canonical = normalizeOrgName(clean)
    const clash = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true } })
    if (clash && clash.id !== r.id) {
      // The clean name is the same organization: the scraped-name row is a duplicate. Use the app's own merge (it moves
      // everything to the survivor and refuses when both sides hold a single-slot record).
      console.log(`MERGE ${r.id} ("${clean}") into existing ${clash.id}`)
      if (apply) {
        try { const m = await mergeOrganizations(clash.id, r.id, null); if (!m.ok) console.log(`  refused: ${m.reason}`) } catch (e) { console.log(`  FAILED: ${String(e).slice(0, 300)}`) }
      }
      continue
    }
    console.log(`${r.id}: "${r.name.slice(0, 50).replace(/\n/g, ' ')}…" -> "${clean}"`)
    if (apply) {
      await prisma.crmOrganization.update({ where: { id: r.id }, data: { name: clean, canonicalNameNormalized: canonical } })
      await prisma.searchFirm.updateMany({ where: { crmOrgId: r.id }, data: { name: clean } })
    }
  }
  console.log(apply ? 'APPLIED' : 'DRY RUN')
}
main().finally(() => prisma.$disconnect())
