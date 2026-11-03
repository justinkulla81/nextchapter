import { familyOfRanking } from '@/lib/rankings/awards'
import { stateName } from '@/lib/seo/states'
import { functionByName } from '@/lib/seo/topics'
import type { PageCaptureConfig } from '@/lib/capture/page-capture'
import type { RankingIndexEntry } from '@/lib/rankings/types'

// What a ranking page asks a visitor for: the journey question and an email save of the job search the page is about (the job
// family, the industry, the state, or the kind of job the list ranks), so the box offers the jobs this page is about.

type Entry = Pick<RankingIndexEntry, 'slug' | 'measure' | 'scopeKind' | 'scopeName' | 'family'>

const AI_MEASURES = new Set(['ai', 'aiskills', 'aitools', 'aicerts', 'skillpay', 'indpay'])

export function rankingCapture(e: Entry): PageCaptureConfig {
  const slug = e.slug.slice(0, 70)
  const fn = familyOfRanking(e)
  if (fn) {
    const name = (functionByName(fn)?.name ?? fn).toLowerCase()
    return { kind: 'ranking', slug, label: name, save: { q: name, loc: '' } }
  }
  const industry = /^best-cities-for-(.+?)(?:-pay-vs-cost-of-living|-jobs)$/.exec(e.slug)
  if (industry && e.family === 'Industry markets') {
    const phrase = industry[1].replace(/-/g, ' ')
    return { kind: 'ranking', slug, label: phrase, save: { q: phrase, loc: '' } }
  }
  if (e.measure === 'junior') return { kind: 'ranking', slug, label: 'entry-level', save: { q: 'entry level', loc: e.scopeKind === 'state' ? e.scopeName : '' } }
  if (e.measure === 'swe') return { kind: 'ranking', slug, label: 'software engineering', save: { q: 'software engineer', loc: e.scopeKind === 'state' ? e.scopeName : '' } }
  if (AI_MEASURES.has(e.measure)) return { kind: 'ranking', slug, label: 'AI-skill', save: { q: 'AI', loc: e.scopeKind === 'state' ? e.scopeName : '' } }
  if (e.scopeKind === 'state') return { kind: 'ranking', slug, label: stateName(e.scopeName) || e.scopeName, save: { q: '', loc: e.scopeName } }
  return { kind: 'ranking', slug, label: 'professional', save: { q: '', loc: '' } }
}
