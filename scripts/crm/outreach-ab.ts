/**
 * A/B results for cold outreach, read from the CRM. Each send logged by outreach-log.ts carries its template, test and variant.
 * A send counts as replied when that person has an inbound email within 14 days of it. Opens come from Resend's open event and are
 * directional only (mail privacy features inflate them), so compare variants with each other, never to a benchmark; replies are the real measure.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-ab.ts
 *
 * For each template and test: sends and replies per variant, the reply rates, a two-sided p-value, and how many sends per variant
 * would be needed to tell the observed rates apart (80% power, 5% significance). Differences below 95% confidence are labelled "keep testing".
 */
import { prisma } from '../../src/lib/prisma'

const REPLY_WINDOW_MS = 14 * 86_400_000
type Cell = { sends: number; replies: number; opens: number }

// Two-proportion z-test (pooled). Returns the two-sided p-value.
function pValue(a: { sends: number; replies: number }, b: { sends: number; replies: number }): number {
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
    const c = cells.get(k) ?? { sends: 0, replies: 0, opens: 0 }
    c.sends++
    if ((s.outcome ?? '').includes(', opened')) c.opens++
    if ((repliedAt.get(s.personId!) ?? []).some((t) => t >= s.occurredAt && t.getTime() - s.occurredAt.getTime() <= REPLY_WINDOW_MS)) c.replies++
    cells.set(k, c)
  }
  if (!cells.size) { console.log('No tagged cold-outreach sends logged yet. Log them with outreach-log.ts sent <sends.csv> --apply (CSV needs template and variant).'); return }

  // Pool wordings into concepts (C1 outcome, C2 market data); plain A/B tests compare the two variants directly.
  const arms = [...cells.entries()].map(([k, c]) => ({ template: k.split('|')[0], test: k.split('|')[1], variant: k.split('|')[2], ...c }))
  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + '%' : '-')
  for (const template of [...new Set(arms.map((a) => a.template))].sort()) {
    const mine = arms.filter((a) => a.template === template)
    console.log(`\n${template}`)
    for (const a of [...mine].sort((x, y) => x.variant.localeCompare(y.variant))) console.log(`  ${a.variant}: ${a.sends} sent, opened ${a.opens} (${pct(a.opens, a.sends)}), replied ${a.replies} (${pct(a.replies, a.sends)})`)
    const pool = (prefix: string) => mine.filter((a) => a.variant.startsWith(prefix)).reduce((x, a) => ({ sends: x.sends + a.sends, replies: x.replies + a.replies, opens: x.opens + a.opens }), { sends: 0, replies: 0, opens: 0 })
    const c1 = pool('C1'), c2 = pool('C2')
    if (c1.sends && c2.sends) {
      const po = pValue({ sends: c1.sends, replies: c1.opens }, { sends: c2.sends, replies: c2.opens })
      const pr = pValue(c1, c2)
      const need = needed(c1.replies / c1.sends, c2.replies / c2.sends)
      console.log(`  concept C1 (outcome) vs C2 (market data): opens ${pct(c1.opens, c1.sends)} vs ${pct(c2.opens, c2.sends)} (p=${po.toFixed(2)}${po < 0.05 ? ', real' : ', keep testing'}); replies ${pct(c1.replies, c1.sends)} vs ${pct(c2.replies, c2.sends)} (p=${pr.toFixed(2)}${pr < 0.05 ? ', real' : ', keep testing'})${need && pr >= 0.05 ? `; about ${need} sends per concept to confirm a reply gap this size` : ''}`)
    }
    const a = mine.find((x) => x.variant === 'A'), b = mine.find((x) => x.variant === 'B')
    if (a && b) { const pr = pValue(a, b); console.log(`  A vs B replies p=${pr.toFixed(2)}${pr < 0.05 ? ' (real)' : ' (keep testing)'}`) }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
