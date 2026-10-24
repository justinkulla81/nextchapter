// Backfill: subscribes every CRM person to the mailing lists that fit their type,
// and writes the people whose type fits no list to a CSV.
// Run: npx tsx scripts/mailing/auto-assign.ts [--dry-run]
import { writeFileSync } from 'fs'
import { autoAssignLists } from '@/lib/mailing/autoassign'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const r = await autoAssignLists({ dryRun })
  const out = `${process.env.HOME}/nc-mailing-unassigned-${new Date().toISOString().slice(0, 10)}.csv`
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`
  writeFileSync(out, ['name,email,roles,crm_id', ...r.unassigned.map((u) => [q(u.name), q(u.email), q(u.roles.join(' ')), u.id].join(','))].join('\n'))
  console.log(JSON.stringify({ dryRun, scanned: r.scanned, added: r.added, noEmail: r.noEmail, unassigned: r.unassigned.length, csv: out }, null, 2))
}
main().then(() => process.exit(0))
