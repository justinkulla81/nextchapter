/**
 * A/B results for cold outreach, read from the CRM. Each send logged by outreach-log.ts carries its template, test and variant.
 * A send counts as replied when that person has an inbound email within 14 days of it. Opens are not tracked (a pixel is
 * unreliable and hurts deliverability); reply rate is the measure.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-ab.ts
 *
 * For each template and test: sends and replies per variant, the reply rates, a two-sided p-value, and how many sends per variant
 * would be needed to tell the observed rates apart (80% power, 5% significance). Differences below 95% confidence are labelled "keep testing".
 */
import { prisma } from '../../src/lib/prisma'

const REPLY_WINDOW_MS = 14 * 86_400_000
type Cell = { sends: number; replies: number }

// Two-proportion z-test (pooled). Returns the two-sided p-value.
function pValue(a: Cell, b: Cell): number {
  const p = (a.replies + b.replies) / (a.sends + b.sends)
  const se = Math.sqrt(p * (1 - p) * (1 / a.sends + 1 / b.sends))
  if (!se) return 1
  const z = Math.abs((a.replies / a.sends - b.replies / b.sends) / se)
  // Normal tail via the Abramowitz-Stegun approximation.
  const t = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp((-z * z) / 2)
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return Math.min(1, 2 * tail)
}
// Sends per variant to detect p1 vs p2 at 80% power, 5% significance.
function needed(p1: number, p2: number): number | null {
  const d = Math.abs(p1 - p2)
  if (d < 0.005) return null
  const pb = (p1 + p2) / 2
  return Math.ceil((2 * (1.96 + 0.84) ** 2 * pb * (1 - pb)) / (d * d))
}

async function main() {
  const sends = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach, email 1' }, personId: { not: null } },
    select: { personId: true, occurredAt: true, outcome: true },
  })
  const parse = (o: string | null) => ({ template: /template (\S+?)(,|$)/.exec(o ?? '')?.[1] ?? 'unknown', test: /test (\S+?)(,|$)/.exec(o ?? '')?.[1] ?? 'subject', variant: /variant (\S+)/.exec(o ?? '')?.[1] ?? 'A' })
  const replies = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'INBOUND', personId: { in: [...new Set(sends.map((s) => s.personId!))] } },
    select: { personId: true, occurredAt: true },
  })
  const repliedAt = new Map<string, Date[]>()
  for (const r of replies) repliedAt.set(r.personId!, [...(repliedAt.get(r.personId!) ?? []), r.occurredAt])

  const cells = new Map<string, Cell>()
  for (const s of sends) {
    const { template, test, variant } = parse(s.outcome)
    const k = `${template}|${test}|${variant}`
    const c = cells.get(k) ?? { sends: 0, replies: 0 }
    c.sends++
    if ((repliedAt.get(s.personId!) ?? []).some((t) => t >= s.occurredAt && t.getTime() - s.occurredAt.getTime() <= REPLY_WINDOW_MS)) c.replies++
    cells.set(k, c)
  }
  if (!cells.size) { console.log('No tagged cold-outreach sends logged yet. Log them with outreach-log.ts sent <sends.csv> --apply (CSV needs template and variant).'); return }

  const groups = new Set([...cells.keys()].map((k) => k.split('|').slice(0, 2).join('|')))
  for (const g of [...groups].sort()) {
    const A = cells.get(`${g}|A`) ?? { sends: 0, replies: 0 }, B = cells.get(`${g}|B`) ?? { sends: 0, replies: 0 }
    const [template, test] = g.split('|')
    const rate = (c: Cell) => (c.sends ? ((100 * c.replies) / c.sends).toFixed(1) + '%' : '-')
    let verdict = 'waiting for both variants'
    if (A.sends && B.sends) {
      const p = pValue(A, B)
      const n = needed(A.replies / A.sends, B.replies / B.sends)
      verdict = p < 0.05 ? `real difference (p=${p.toFixed(3)}): ${A.replies / A.sends > B.replies / B.sends ? 'A' : 'B'} wins` : `keep testing (p=${p.toFixed(2)})${n ? `; about ${n} sends per variant to confirm a gap this size` : ''}`
    }
    console.log(`${template} / ${test}: A ${A.replies}/${A.sends} (${rate(A)}) vs B ${B.replies}/${B.sends} (${rate(B)}) — ${verdict}`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
