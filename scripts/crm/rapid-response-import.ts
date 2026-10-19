/**
 * Puts the state Rapid Response coordinators into the CRM. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/rapid-response-import.ts <file.csv> [--apply]
 *
 * The file is the U.S. Department of Labor's "State Rapid Response Coordinators"
 * page, one row per coordinator: stateCode, jurisdiction, name, title, agency,
 * phone, email, teamMailbox, flag. Each state agency becomes a government
 * organization, each named coordinator a business-development contact (the
 * people who learn of a layoff first and offer the employer its services).
 *
 *   - A coordinator with no personal address is added without an email; the
 *     team mailbox goes in the note.
 *   - A row with no name (Kentucky, Wisconsin, Puerto Rico) is skipped and
 *     listed, since the page names no one.
 *   - Nothing is merged on a guess: a name that matches someone else lands on
 *     the Review List (addContactToCrm).
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

async function main() {
  const [file, flag] = process.argv.slice(2)
  if (!file) { console.log('usage: <file.csv> [--apply]'); return }
  const apply = flag === '--apply'
  const rows = parseCsv(readFileSync(file, 'utf8'))
  const tally = { rows: rows.length, added: 0, matched: 0, review: 0, removed: 0, skippedNoName: 0 }

  for (const r of rows) {
    if (!r.name || r.name.split(/\s+/).length < 2) {
      tally.skippedNoName++
      console.log(`skip (no named person): ${r.jurisdiction}, ${r.agency}${r.teamMailbox ? `, ${r.teamMailbox}` : ''}`)
      continue
    }
    const note = `${r.title || 'Rapid Response contact'} at ${r.agency} (${r.jurisdiction}). ${r.source || "From the U.S. Department of Labor's State Rapid Response Coordinators page."}`
      + (r.teamMailbox ? ` Team mailbox: ${r.teamMailbox}.` : '')
      + (r.flag ? ` Check: ${r.flag}.` : '')
    if (!apply) { console.log(`would add: ${r.name}, ${r.title}, ${r.agency}, ${r.email || '(no email)'}`); continue }
    const org = await ensureOrg({ name: r.agency, type: 'GOVERNMENT', state: r.stateCode })
    const res = await addContactToCrm({
      fullName: r.name, title: r.title || 'Rapid Response contact', email: r.email || null, phone: r.phone || null,
      orgId: org.id, orgName: org.name, roles: ['BD_PARTNER'], goals: ['BD'], priority: 'P2', note,
    })
    if (res.outcome === 'removed') tally.removed++
    else tally[res.outcome]++
  }
  console.log(tally)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
