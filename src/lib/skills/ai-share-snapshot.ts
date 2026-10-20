// The weekly AI-share snapshot: of the live board's postings, how many ask for a specific AI
// skill, per function. Stored one row per week x function so the share has a trend.
// Pure counting here; the cron (ai-share-snapshot-server.ts) reads the board and writes.
// Tested in src/test/ai-share-snapshot.test.ts.

export interface SnapshotPosting {
  /** Function code (targetFunction, else inferred from the title). */
  fn: string | null
  aiSkillGroups: readonly string[] | null | undefined
}

export interface SnapshotRow {
  fn: string
  total: number
  withAi: number
}

export const ALL_FUNCTIONS = 'all'

/** One row per function plus an 'all' row. A posting with no function counts only in 'all'. */
export function countAiShare(postings: SnapshotPosting[]): SnapshotRow[] {
  const by = new Map<string, SnapshotRow>()
  const bump = (fn: string, ai: boolean) => {
    const r = by.get(fn) ?? { fn, total: 0, withAi: 0 }
    r.total++
    if (ai) r.withAi++
    by.set(fn, r)
  }
  for (const p of postings) {
    const ai = (p.aiSkillGroups?.length ?? 0) > 0
    bump(ALL_FUNCTIONS, ai)
    if (p.fn) bump(p.fn, ai)
  }
  return [...by.values()].sort((a, b) => (a.fn === ALL_FUNCTIONS ? -1 : b.fn === ALL_FUNCTIONS ? 1 : b.total - a.total))
}

/** The Monday (UTC, midnight) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const back = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - back)
  return x
}

export const sharePct = (r: Pick<SnapshotRow, 'total' | 'withAi'>) => (r.total === 0 ? 0 : Math.round((r.withAi / r.total) * 1000) / 10)
