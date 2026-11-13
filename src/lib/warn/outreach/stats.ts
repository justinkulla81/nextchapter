/** Campaign counts for the layoff outreach page. Pure, so the rollups are tested without a database. */

export interface Counts {
  recipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  unsubscribed: number
  bounced: number
}

export const emptyCounts = (): Counts => ({ recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0, bounced: 0 })

export function addCounts(a: Counts, b: Counts): Counts {
  return {
    recipients: a.recipients + b.recipients, sent: a.sent + b.sent, delivered: a.delivered + b.delivered, opened: a.opened + b.opened,
    clicked: a.clicked + b.clicked, replied: a.replied + b.replied, unsubscribed: a.unsubscribed + b.unsubscribed, bounced: a.bounced + b.bounced,
  }
}

/** A share as a whole percent of what was sent; a dash when nothing has gone out. */
export const pct = (n: number, sent: number): string => (sent > 0 ? `${Math.round((n / sent) * 100)}%` : '–')

export interface EditionRow { id: string; audience: string | null; warnNoticeId: string | null }

/** Counts rolled up by a key (the audience, or the layoff and audience), from per-edition counts. */
export function rollup<K extends string>(editions: EditionRow[], byEdition: Map<string, Counts>, keyOf: (e: EditionRow) => K | null): Map<K, Counts> {
  const out = new Map<K, Counts>()
  for (const e of editions) {
    const k = keyOf(e)
    if (!k) continue
    out.set(k, addCounts(out.get(k) ?? emptyCounts(), byEdition.get(e.id) ?? emptyCounts()))
  }
  return out
}

/** The headline style and the send day of a backfill edition, from its title ("... · h:q1 · day 1"), or null for an edition that is not part of the test. */
export function headlineOf(title: string | null | undefined): { code: string; day: number } | null {
  const m = /· h:([a-z0-9]+) · day (\d+)\s*$/.exec(title ?? '')
  return m ? { code: m[1], day: Number(m[2]) } : null
}
