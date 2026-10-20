/**
 * Sends one day of the outreach calendar through Resend and logs each send in the CRM. Dry run unless --apply.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-send.ts <schedule.csv> <merge.csv> [YYYY-MM-DD] [--apply]
 *
 * For the date (default today): every step-1 email on the calendar, and any follow-up that is due. A person is skipped, for every step, when they
 * replied, were passed, bounced or complained, are on the do-not-contact list, or have already been sent that step. Sent with the tag `outreach`
 * (so bounces and complaints stop mail through the Resend webhook), a Reply-To of justin@, and a one-click mailto unsubscribe header.
 * Env: OUTREACH_FROM (default "Justin Kulla <justin@updates.launchyournextchapter.com>"), OUTREACH_REPLY_TO, OUTREACH_MAX (hard cap per run, default 30).
 */
import { readFileSync, existsSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { refreshTouchFields } from '../../src/lib/crm/sync'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

type Row = Record<string, string>
function parseCsv(text: string): Row[] {
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
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** A shared inbox (a job center or college office) has no CRM person yet: add one so the send can be logged and measured. */
async function ensurePerson(m: Row, email: string) {
  if (!EMAIL_OK.test(email)) return null
  const org = await ensureOrg({ name: m.recipient_org, type: m.template === 'college' ? 'UNIVERSITY' : 'GOVERNMENT' })
  const generic = !m.first_name || ['team', 'hello'].includes(m.first_name.toLowerCase())
  const r = await addContactToCrm({
    fullName: generic ? `${m.recipient_org} ${m.recipient_title || 'office'}`.slice(0, 120) : `${m.first_name} (${m.recipient_org})`, title: m.recipient_title || null, email,
    orgId: org.id, orgName: org.name, roles: ['BD_PARTNER'], goals: goalsForRoles(['BD_PARTNER']), priority: 'P2',
    note: 'Added so cold outreach could be logged and measured. A shared or role inbox, not a named person.',
  }).catch(() => null)
  if (!r || r.outcome === 'removed') return null
  return prisma.crmPerson.findUnique({ where: { id: r.personId }, select: { id: true, passedAt: true, firstRepliedAt: true, emailVerifiedStatus: true } })
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--apply')
  const apply = process.argv.includes('--apply')
  const [schedFile, mergeFile, dateArg] = args
  if (!schedFile || !mergeFile) { console.log('usage: outreach-send.ts <schedule.csv> <merge.csv> [date] [--apply]'); return }
  const date = dateArg ?? new Date().toISOString().slice(0, 10)
  const key = process.env.RESEND_API_KEY
  if (apply && !key) throw new Error('RESEND_API_KEY is not set')
  const from = process.env.OUTREACH_FROM ?? 'Justin Kulla <justin@updates.launchyournextchapter.com>'
  const replyTo = process.env.OUTREACH_REPLY_TO ?? 'justin@launchyournextchapter.com'
  const MAX = Number(process.env.OUTREACH_MAX ?? 30)

  const templates = JSON.parse(readFileSync('scripts/crm/outreach-templates.json', 'utf8')) as { signature: string; footer: string[] }
  const merge = new Map(parseCsv(readFileSync(mergeFile, 'utf8')).map((r) => [r.email.toLowerCase(), r]))
  const due = parseCsv(readFileSync(schedFile, 'utf8')).filter((s) => s.date === date)
  const suppressFile = '/Users/salitkulla/nc-hunter-results/suppress.txt'
  const dnc = new Set(existsSync(suppressFile) ? readFileSync(suppressFile, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean) : [])
  for (const m of await prisma.mailingSuppression.findMany({ select: { email: true } })) dnc.add(m.email.toLowerCase())

  let sent = 0, skipped = 0
  const why: Record<string, number> = {}
  const skip = (r: string) => { skipped++; why[r] = (why[r] ?? 0) + 1 }
  for (const s of due) {
    if (sent >= MAX) { skip('over the run cap'); continue }
    const email = s.email.toLowerCase(), step = Number(s.step), m = merge.get(email)
    if (!m) { skip('not in the merge file'); continue }
    if (dnc.has(email)) { skip('do not contact'); continue }
    const existing = await prisma.crmPerson.findFirst({ where: { deletedAt: null, OR: [{ email: { equals: email, mode: 'insensitive' } }, { emails: { has: email } }] }, select: { id: true, passedAt: true, firstRepliedAt: true, emailVerifiedStatus: true } })
    const person = existing ?? (await ensurePerson(m, email))
    if (!person) { skip('no CRM record'); continue }
    if (person.passedAt || person.firstRepliedAt) { skip('replied or passed'); continue }
    if (person.emailVerifiedStatus === 'invalid') { skip('address invalid'); continue }
    const already = await prisma.crmActivity.findFirst({ where: { personId: person.id, type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: `Cold outreach, email ${step}` } }, select: { id: true } })
    if (already) { skip('already sent'); continue }
    if (step > 1) {
      const first = await prisma.crmActivity.findFirst({ where: { personId: person.id, type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach, email 1' } }, select: { id: true, outcome: true } })
      if (!first) { skip('follow-up without a first email'); continue }
      if ((first.outcome ?? '').includes(', bounced')) { skip('first email bounced'); continue }
    }

    const subject = step === 1 ? m.subject : m.subject.startsWith('Re:') ? m.subject : `Re: ${m.subject}`
    const body = step === 1 ? null : (step === 2 ? m.followup_1 : m.followup_2)
    const text = step === 1 ? m.email_text : [body, 'Justin', templates.signature, templates.footer.join('\n')].join('\n\n')
    const html = step === 1 ? m.email_html : '<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#111">' + esc([body, 'Justin', templates.signature].join('\n\n')).replace(/\n/g, '<br>') + `<span style="display:block;margin-top:14px;font-size:11px;line-height:1.5;color:#8a919c">${esc(templates.footer.join('\n')).replace(/\n/g, '<br>')}</span></div>`
    const tag = (v: string) => (v || 'none').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)
    console.log(`${apply ? 'send' : 'would send'} step ${step} [${s.audience}/${s.arm}] ${email} | ${subject}`)
    if (!apply) { sent++; continue }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [email], subject, html, text, reply_to: replyTo,
        headers: { 'List-Unsubscribe': `<mailto:${replyTo}?subject=no>` },
        tags: [{ name: 'outreach', value: tag(m.template) }, { name: 'variant', value: tag(m.variant) }, { name: 'step', value: String(step) }],
      }),
    })
    const out = await res.json().catch(() => ({})) as { id?: string; message?: string }
    if (!res.ok || !out.id) { console.error('FAILED', email, res.status, out.message ?? ''); skip('send failed'); await sleep(600); continue }
    await prisma.crmActivity.create({
      data: {
        type: 'EMAIL', direction: 'OUTBOUND', occurredAt: new Date(), personId: person.id, subject,
        outcome: `Cold outreach, email ${step}, template ${m.template}, test subject, variant ${m.variant}, timing ${m.timing || 'none'}, timing_test ${m.timing_test || 'no'}`,
        sourceRef: `resend:${out.id}`,
      },
    })
    await refreshTouchFields([person.id])
    sent++
    await sleep(600)
  }
  console.log(`${date}: ${apply ? 'sent' : 'would send'} ${sent}, skipped ${skipped}${skipped ? ' (' + Object.entries(why).map(([k, v]) => `${k}: ${v}`).join(', ') + ')' : ''}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
