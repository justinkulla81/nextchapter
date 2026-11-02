import 'server-only'
import { getJobStats, type JobStats } from '@/lib/seo/topic-data'
import { CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'
import { functionByName, functionPath } from '@/lib/seo/topics'
import { roleForTitle, roleByKey, SOURCES, TIME_LABEL, type PivotEdge } from '@/lib/pivots/pivot-map'
import { projectionFor, projectionLine, type OccupationProjection } from '@/lib/market/occupation-projections'
import { socForTitle } from '@/lib/seo/title-soc'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'
import { exposureSentence, type OccupationExposure } from '@/lib/skills/ai-exposure'
import { AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'

// What a job-title page shows beyond its listings: the market reality for the work. Every part is read from stored figures
// (the topic snapshot, BLS projections shipped as JSON, the stored AI-exposure table), never a scan on a page view, and every part
// is optional: a title with no match in the pivot map simply shows fewer sections.

export interface TitlePivot { to: string; label: string; time: string; fit: PivotEdge['fit']; brings: string[]; why: string }
export interface TitleInsights {
  fnLabel: string | null
  fnPath: string | null
  stats: JobStats | null
  /** The BLS occupation the outlook and AI figures describe (title-soc.ts), named on the page so the stand-in is visible. */
  occupation: { title: string; soc6: string } | null
  outlook: { line: string; data: OccupationProjection } | null
  exposure: (OccupationExposure & { sentence: string }) | null
  pivots: TitlePivot[]
  /** The skills the check compares a résumé against: the function's most-named skills, up to 10. */
  skills: string[]
  /** AI skills worth naming for this kind of work, with the wording a résumé uses. */
  aiSkills: { label: string; words: string[] }[]
}

const BUILDER_FNS = new Set(['Engineering', 'Data & Analytics', 'Security'])
const LEADER_FNS = new Set(['Executive Leadership', 'Strategy', 'Product', 'Operations'])

function aiItemsFor(fnLabel: string | null) {
  const groups = new Set(['applied'])
  if (fnLabel && BUILDER_FNS.has(fnLabel)) groups.add('builder')
  if (fnLabel && LEADER_FNS.has(fnLabel)) groups.add('leadership')
  return AI_SKILL_ITEMS.filter((i) => groups.has(i.group)).slice(0, 8).map((i) => ({ label: i.label, words: [i.label, ...i.aliases] }))
}

export async function loadTitleInsights(title: string, fnCode: string | null | undefined): Promise<TitleInsights> {
  // The title stats carry the function's display label ("Sales"); older rows may carry the crawler code ("sales").
  const fnLabel = fnCode ? (functionByName(fnCode) ? fnCode : CRAWLER_FUNCTION_LABEL[fnCode] ?? null) : null
  const fn = functionByName(fnLabel)
  const roleKey = roleForTitle(title)
  const soc = socForTitle(title)
  const [stats, exp] = await Promise.all([
    fnLabel ? getJobStats({ fn: fnLabel }).catch(() => null) : Promise.resolve(null),
    loadExposureForSoc(soc).catch(() => null),
  ])
  const o = projectionFor(soc)
  const edges = roleKey ? SOURCES.get(roleKey)?.edges ?? [] : []
  const order = { close: 0, adjacent: 1, stretch: 2 } as const
  const pivots = [...edges]
    .sort((a, b) => order[a.fit] - order[b.fit])
    .slice(0, 4)
    .flatMap((e) => {
      const r = roleByKey(e.to)
      return r ? [{ to: e.to, label: r.label, time: TIME_LABEL[e.time], fit: e.fit, brings: e.brings.slice(0, 3), why: e.why }] : []
    })
  return {
    fnLabel,
    fnPath: fn ? functionPath(fn.name) : null,
    stats,
    occupation: o ? { title: o.title, soc6: o.soc6 } : null,
    outlook: o ? { line: projectionLine(o), data: o } : null,
    exposure: exp ? { ...exp, sentence: exposureSentence(exp) } : null,
    pivots,
    skills: (stats?.skills ?? []).slice(0, 10).map((s) => s.name),
    aiSkills: aiItemsFor(fnLabel),
  }
}
