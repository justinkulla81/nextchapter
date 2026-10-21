/**
 * Records cold-email sends in the CRM and keeps the do-not-contact list current.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-log.ts sent <sends.csv> [--apply]
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-log.ts stop <email> <reply|bounce|no> [--apply]
 *
 * sends.csv needs `email` and `subject`; `template`, `variant` (A, B, C1a, C1b, C2a or C2b), `timing` and `timing_test` (from the merge file), `resend_id` (so opens and clicks match) and `test` (default subject) feed scripts/crm/outreach-ab.ts; `step` (1 first email, 2, 3 follow-ups) and `sent_at` (ISO) are optional.
 * Each send becomes an outbound EMAIL activity on the person and refreshes their touch fields. `stop` adds the address to
 * ~/nc-hunter-results/suppress.txt, which outreach-data.ts reads, and for "no" marks the person passed. Replies are also
 * picked up by the Gmail sync (firstRepliedAt), which outreach-data.ts already treats as suppressed. Dry run unless --apply.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { refreshTouchFields } from '../../src/lib/crm/sync'

const SUPPRESS = '/Users/salitkulla/nc-hunter-results/suppress.txt'

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])))
}

async function findPerson(email: string) {
  const e = email.trim().toLowerCase()
  return prisma.crmPerson.findFirst({ where: { OR: [{ email: { equals: e, mode: 'insensitive' } }, { emails: { has: e } }] }, select: { id: true, fullName: true } })
}

async function sent(file: string, apply: boolean) {
  const rows = parseCsv(readFileSync(file, 'utf8'))
  let logged = 0, missing = 0
  const touched: string[] = []
  for (const r of rows) {
    if (!r.email) continue
    const person = await findPerson(r.email)
    if (!person) { missing++; console.log('no CRM record:', r.email); continue }
    const step = r.step || '1'
    if (apply) {
      const occurredAt = r.sent_at ? new Date(r.sent_at) : new Date()
      const dupe = await prisma.crmActivity.findFirst({ where: { personId: person.id, type: 'EMAIL', direction: 'OUTBOUND', subject: r.subject, occurredAt } })
      if (!dupe) await prisma.crmActivity.create({ data: { type: 'EMAIL', direction: 'OUTBOUND', occurredAt, personId: person.id, subject: r.subject || null, outcome: `Cold outreach, email ${step}, template ${r.template || 'unknown'}, test ${r.test || 'subject'}, variant ${r.variant || 'A'}, timing ${r.timing || 'none'}, timing_test ${r.timing_test || 'no'}`, sourceRef: r.resend_id ? `resend:${r.resend_id}` : null } })
      touched.push(person.id)
    }
    logged++
  }
  if (apply) await refreshTouchFields([...new Set(touched)])
  console.log(`${apply ? 'logged' : 'would log'} ${logged} sends; ${missing} addresses not in the CRM`)
}

async function stop(email: string, reason: string, apply: boolean) {
  if (!['reply', 'bounce', 'no'].includes(reason)) throw new Error('reason must be reply, bounce or no')
  const person = await findPerson(email)
  console.log(`${apply ? '' : 'would '}stop ${email} (${reason})${person ? ` — ${person.fullName}` : ' — not in the CRM'}`)
  if (!apply) return
  appendFileSync(SUPPRESS, `${email.trim().toLowerCase()}\n`)
  if (person && reason === 'no') await prisma.crmPerson.update({ where: { id: person.id }, data: { passedAt: new Date() } })
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2).filter((x) => x !== '--apply')
  const apply = process.argv.includes('--apply')
  if (cmd === 'sent' && a) await sent(a, apply)
  else if (cmd === 'stop' && a && b) await stop(a, b, apply)
  else console.log('usage: outreach-log.ts sent <sends.csv> | stop <email> <reply|bounce|no>  [--apply]')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
