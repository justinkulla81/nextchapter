// Reads "orgId<TAB>website" lines from the file given as the first argument, looks up each firm's brand color a few at a
// time, and prints one SQL upsert for FirmBrandColor (prisma/manual/firm-brand-color.sql). Nothing is written here.
import { readFileSync } from 'node:fs'
import { findBrandColor } from '@/lib/firms/brand-color-fetch'
import { dropSharedDefaults } from '@/lib/firms/brand-color'

const CONCURRENCY = 8

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('\t')).filter((r) => r[0] && r[1])
  let out: { id: string; site: string; color: string | null; source: string }[] = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const [id, site] = rows[next++]
      out.push({ id, site, ...(await findBrandColor(site)) })
    }
  }))
  out = dropSharedDefaults(out).map((o) => (o.color ? o : { ...o, source: 'none' }))
  out.sort((a, b) => a.id.localeCompare(b.id))
  console.error(`${out.filter((o) => o.color).length} of ${out.length} found a color`)
  const q = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`)
  console.log(`INSERT INTO "FirmBrandColor" ("orgId","color","source") VALUES\n${out.map((o) => `(${q(o.id)},${q(o.color)},${q(o.source)})`).join(',\n')}\nON CONFLICT ("orgId") DO UPDATE SET "color" = EXCLUDED."color", "source" = EXCLUDED."source", "checkedAt" = now();`)
}
main()
