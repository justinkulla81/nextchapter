import { CITATION_PROMPT_DEFS, pageBriefFor, type PromptGroup } from './prompts'

// The citation-gap report: for every tracked question, what the assistants last said, and the questions where NextChapter is
// absent, worst first. Pure (rows in, report out) so it is tested without a database; the admin page loads the rows.

/** Answers older than this are not counted: the assistants change their answers, and the list is re-asked on a rotation. */
export const GAP_WINDOW_DAYS = 120

export interface StoredResult {
  provider: string
  promptKey: string
  cited: boolean
  mentioned: boolean
  error: string | null
  citedDomains: string[]
  createdAt: Date
}

export interface PromptStatus {
  key: string
  prompt: string
  group: PromptGroup
  /** Assistants with a usable answer for this question. */
  answered: string[]
  citedBy: string[]
  mentionedBy: string[]
  /** Answered, and neither cited nor named. */
  missedBy: string[]
  /** The other sites the assistants sourced for this question, most often first. */
  rivals: string[]
  page: string | null
  brief: string
}

export interface GapReport {
  /** Questions never asked, or asked only without a usable answer. */
  notAsked: number
  statuses: PromptStatus[]
  /** Questions with at least one answer where we are absent, ordered by assistants that miss us, then by answers. */
  gaps: PromptStatus[]
  share: ShareSummary
}

export interface ShareSummary {
  answers: number
  cited: number
  mentioned: number
  /** Cited or named. */
  present: number
  byProvider: { provider: string; answers: number; cited: number; mentioned: number; present: number }[]
}

export function buildGapReport(rows: StoredResult[], ourDomain: string, now = new Date(), windowDays = GAP_WINDOW_DAYS): GapReport {
  const since = now.getTime() - windowDays * 86_400_000
  // The newest usable answer per question and assistant.
  const latest = new Map<string, StoredResult>()
  for (const r of rows) {
    if (r.error || r.createdAt.getTime() < since) continue
    const k = `${r.promptKey}\u0000${r.provider}`
    const prev = latest.get(k)
    if (!prev || prev.createdAt < r.createdAt) latest.set(k, r)
  }
  const byPrompt = new Map<string, StoredResult[]>()
  for (const r of latest.values()) byPrompt.set(r.promptKey, [...(byPrompt.get(r.promptKey) ?? []), r])

  const statuses: PromptStatus[] = CITATION_PROMPT_DEFS.map((d) => {
    const rs = (byPrompt.get(d.key) ?? []).sort((a, b) => a.provider.localeCompare(b.provider))
    const counts = new Map<string, number>()
    for (const r of rs) for (const dom of r.citedDomains) if (dom !== ourDomain && !dom.endsWith(`.${ourDomain}`)) counts.set(dom, (counts.get(dom) ?? 0) + 1)
    const { page, brief } = pageBriefFor(d.key)
    return {
      key: d.key,
      prompt: d.prompt,
      group: d.group,
      answered: rs.map((r) => r.provider),
      citedBy: rs.filter((r) => r.cited).map((r) => r.provider),
      mentionedBy: rs.filter((r) => r.mentioned).map((r) => r.provider),
      missedBy: rs.filter((r) => !r.cited && !r.mentioned).map((r) => r.provider),
      rivals: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([dom]) => dom),
      page,
      brief,
    }
  })

  const gaps = statuses.filter((s) => s.missedBy.length > 0).sort((a, b) => b.missedBy.length - a.missedBy.length || b.answered.length - a.answered.length || a.key.localeCompare(b.key))

  const prov = new Map<string, { answers: number; cited: number; mentioned: number; present: number }>()
  const total = { answers: 0, cited: 0, mentioned: 0, present: 0 }
  for (const r of latest.values()) {
    if (!CITATION_PROMPT_DEFS.some((d) => d.key === r.promptKey)) continue
    const p = prov.get(r.provider) ?? { answers: 0, cited: 0, mentioned: 0, present: 0 }
    for (const t of [p, total]) {
      t.answers++
      if (r.cited) t.cited++
      if (r.mentioned) t.mentioned++
      if (r.cited || r.mentioned) t.present++
    }
    prov.set(r.provider, p)
  }
  return {
    notAsked: statuses.filter((s) => s.answered.length === 0).length,
    statuses,
    gaps,
    share: { ...total, byProvider: [...prov.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([provider, v]) => ({ provider, ...v })) },
  }
}

/** Dollars to ask `questions` questions of every listed assistant once, at the providers' own per-question estimates. */
export const fullRunCostUsd = (providers: { estCostUsd: number }[], questions: number): number => providers.reduce((s, p) => s + p.estCostUsd, 0) * questions

export const pct = (n: number, d: number): string => (d ? `${Math.round((100 * n) / d)}%` : 'n/a')
