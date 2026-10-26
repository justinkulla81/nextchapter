import 'server-only'
import { cache } from 'react'
import { getIndustryTrends } from '@/lib/market/bls-industry-trends'
import { associationSlug, functionBySlug, industryBySlug } from '@/lib/seo/topics'
import {
  conferencesForFunction, conferencesForIndustry, getAssociations, getFunctionNotices, getIndustryNotices, getJobStats, getTopicJobs,
  type ConfList, type TopicJobs,
} from '@/lib/seo/topic-data'
import { conferenceFacts, exposureFacts, jobFacts, layoffFacts, openingParagraph, trendFact } from '@/lib/seo/topic-facts'
import { assess, assessAssociation, type Assessment, type Fact } from '@/lib/seo/topic-quality'

// One loader per page type, shared by the page and the sitemap so both apply the same quality bar.

const EMPTY_JOBS: TopicJobs = { total: 0, jobs: [], functions: [], industries: [], employers: [] }
const EMPTY_CONFS: ConfList = { total: 0, upcoming: 0, rows: [], summary: { total: 0, upcoming: 0, next: [], cfpOpen: 0, medianCost: null, costed: 0, freeCount: 0, topOrganizers: [], topStates: [] } }

async function organizersWithPages(confs: ConfList): Promise<string[]> {
  const assoc = new Set((await getAssociations().catch(() => [])).map((a) => a.slug))
  const counts = new Map<string, number>()
  for (const c of confs.rows) if (c.organizer && assoc.has(associationSlug(c.organizer))) counts.set(c.organizer, (counts.get(c.organizer) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n)
}

export const loadIndustry = cache(async (slug: string) => {
  const industry = industryBySlug(slug)
  if (!industry) return null
  const [jobs, stats, trends, confs, notices] = await Promise.all([
    industry.rule ? getTopicJobs({ rule: industry.rule }).catch(() => EMPTY_JOBS) : Promise.resolve(EMPTY_JOBS),
    industry.rule ? getJobStats({ rule: industry.rule }) : Promise.resolve(null),
    getIndustryTrends(),
    conferencesForIndustry(industry.name, 24).catch(() => EMPTY_CONFS),
    getIndustryNotices(industry.name),
  ])
  const orgs = await organizersWithPages(confs)
  const trend = trends[industry.name]
  const facts: Fact[] = [
    ...jobFacts(jobs.total, stats),
    ...[trendFact(trend, industry.name)].filter((x): x is Fact => !!x),
    ...layoffFacts(notices, industry.name),
    ...conferenceFacts(confs.summary, industry.name),
  ]
  const links = jobs.functions.length + jobs.employers.length + Math.min(3, confs.rows.length) + orgs.length
  const assessment: Assessment = assess(facts.length, links)
  const intro = openingParagraph({ name: industry.name, kind: 'industry', blurb: industry.blurb, total: jobs.total, stats, trend, notices: notices.length, confs: confs.total, upcomingConfs: confs.upcoming })
  return { industry, jobs, stats, trend, confs, notices, orgs, facts, assessment, intro }
})

export const loadFunction = cache(async (slug: string) => {
  const fn = functionBySlug(slug)
  if (!fn) return null
  const [jobs, stats, confs, notices] = await Promise.all([
    getTopicJobs({ fn: fn.name }).catch(() => EMPTY_JOBS),
    getJobStats({ fn: fn.name }),
    conferencesForFunction(fn.name, 24).catch(() => EMPTY_CONFS),
    getFunctionNotices(fn.name).catch(() => []),
  ])
  const orgs = await organizersWithPages(confs)
  const facts: Fact[] = [
    ...jobFacts(jobs.total, stats),
    ...exposureFacts(fn.name),
    ...layoffFacts(notices, `employers hiring ${fn.name}`),
    ...conferenceFacts(confs.summary, fn.name),
  ]
  const links = jobs.industries.length + jobs.employers.length + Math.min(3, confs.rows.length) + orgs.length
  const assessment: Assessment = assess(facts.length, links)
  const intro = openingParagraph({ name: fn.name, kind: 'function', blurb: fn.blurb, total: jobs.total, stats, notices: notices.length, confs: confs.total, upcomingConfs: confs.upcoming })
  return { fn, jobs, stats, confs, notices, orgs, facts, assessment, intro }
})

export const loadAssociation = cache(async (slug: string) => {
  const { getAssociation, conferencesForOrganizer } = await import('@/lib/seo/topic-data')
  const a = await getAssociation(slug)
  if (!a) return null
  const confs = await conferencesForOrganizer(a.organizers)
  const tally = (pick: (c: (typeof confs.rows)[number]) => string[]) => {
    const m = new Map<string, number>()
    for (const c of confs.rows) for (const v of pick(c)) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m].sort((x, y) => y[1] - x[1]).slice(0, 10)
  }
  const industries = tally((c) => c.industries)
  const functions = tally((c) => c.functions)
  const sm = confs.summary
  const facts: Fact[] = [
    ...conferenceFacts(sm, a.name),
    ...(sm.topStates.length ? [{ key: 'where', label: 'Where the events are held', value: sm.topStates.map((x) => `${x.state} (${x.count})`).join(', '), source: 'NextChapter conference catalog' }] : []),
    ...(sm.freeCount ? [{ key: 'free', label: 'Free to attend', value: `${sm.freeCount} of ${sm.total}`, source: 'NextChapter conference catalog' }] : []),
  ]
  const assessment = assessAssociation(confs.rows as never)
  return { a, confs, industries, functions, facts, assessment }
})
