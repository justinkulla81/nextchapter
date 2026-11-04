import { SITE_URL } from '@/lib/seo/facts'
import { fmtPct, MIN_SKILL_POSTINGS, topSkills, type SkillMarket } from '@/lib/skills/market'
import type { FunctionPremium } from '@/lib/market/ai-pay-premium'
import type { RankingIndexEntry } from '@/lib/rankings/types'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { headlineChange, headlineIndex, monthLabel as indexMonthLabel } from '@/lib/reports-wc-index'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { textBudget } from '@/lib/social/posts'
import { STATE_AGENCIES } from '@/lib/social/tag-handles'

/**
 * A fact is one verified finding a post can be written from: the numbers, where to read more and a plain template for the day the
 * writer is off. Nothing here talks; the writer (writer.ts) turns the lines into a post and the checker (validate.ts) rejects a draft
 * that adds a number.
 */
export type Topic = 'layoff' | 'ranking' | 'ai-pay' | 'skill' | 'help' | 'press'

export interface Fact {
  /** Stable id, so a fact is posted once per edition and channel. */
  key: string
  topic: Topic
  /** Plain statements the post may use. Every number in a post must come from these, written the way the post should write it. */
  lines: string[]
  /** Page the post links to, with a leading slash. */
  path: string
  campaign: string
  /** Organizations whose data or research the post rests on: keys of the tag registry (tags.ts). Code adds their handles, the writer never does. */
  cites?: string[]
  /** U.S. state the fact is about, so a help post can follow a layoff in the same state. */
  state?: string
  /** The plain post for when the writer is off, over its cap, or its draft fails the check. */
  fallback: (link: string, shortLinks: boolean) => string
}

export const factLink = (f: Fact, channel: string): string => `${SITE_URL}${f.path}?utm_source=${channel}&utm_medium=social&utm_campaign=${f.campaign}`

/** The longest link any channel gets, so a draft that fits with it fits everywhere. */
export const longestLink = (f: Fact): string => factLink(f, 'facebook')

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const editionLabel = (edition: string) => `${MONTHS[Number(edition.slice(5, 7)) - 1]} ${edition.slice(0, 4)}`
const n = (v: number) => v.toLocaleString('en-US')
const usdK = (v: number) => `$${Math.round(v / 1000).toLocaleString('en-US')}k`

/** Shrinks `name` (with a trailing ellipsis) until `build(name)` fits the budget. */
function fit(build: (name: string) => string, name: string, budget: number): string {
  const shown = (v: string) => (v === name ? v : `${v}…`)
  let v = name
  while (v.length > 12 && build(shown(v)).length > budget) v = v.slice(0, -2).trimEnd()
  return build(shown(v))
}

// ---- Rankings: lists, hot places, entry-level, skills ---------------------------------------------------------------

/** Rankings built for employment readers; college, profile and support lists are not posted. */
const SKIP_GROUPS = new Set(['college', 'profile', 'support'])

const thisOrLastMonth = (edition: string, now: Date) => {
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const prev = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`
  return edition === cur || edition === prev
}

/** National lists first, then the widest lists, newest edition only. */
export function rankingFacts(index: RankingIndexEntry[], now: Date): Fact[] {
  return index
    .filter((x) => x.edition === x.editions[0] && thisOrLastMonth(x.edition, now) && !(x.group && SKIP_GROUPS.has(x.group)) && x.topName && x.topValueLabel)
    .sort((a, b) => Number(b.scopeKind === 'national') - Number(a.scopeKind === 'national') || b.places - a.places)
    .map((x) => ({
      key: `story-ranking-${x.slug}-${x.edition}`,
      topic: 'ranking' as const,
      lines: [
        `List: ${x.title}`,
        `Covers: ${x.scopeKind === 'national' ? 'the United States' : x.scopeName}`,
        `Edition: ${editionLabel(x.edition)}`,
        `Number one: ${x.topName} (${x.topValueLabel})`,
        `Places ranked: ${n(x.places)}`,
      ],
      path: `/rankings/${x.slug}`,
      campaign: 'ranking-story',
      fallback: (link: string, short: boolean) =>
        fit((t) => `#1 on ${t}, ${editionLabel(x.edition)}: ${x.topName} (${x.topValueLabel}). The full list: ${link}`, x.title, textBudget(link, short)),
    }))
}

// ---- AI skills and pay ----------------------------------------------------------------------------------------------

export const MIN_AI_PAY_SIDE = 20

export function aiPayFacts(rows: FunctionPremium[], now: Date): Fact[] {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return rows
    .filter((r) => r.premiumPct !== null && r.medianWithAi !== null && r.medianWithoutAi !== null && r.withAi >= MIN_AI_PAY_SIDE && r.withoutAi >= MIN_AI_PAY_SIDE)
    .sort((a, b) => Math.abs(b.premiumPct as number) - Math.abs(a.premiumPct as number))
    .map((r) => {
      const pct = Math.abs(r.premiumPct as number)
      const dir = (r.premiumPct as number) >= 0 ? 'higher' : 'lower'
      return {
        key: `story-aipay-${r.function.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}`,
        topic: 'ai-pay' as const,
        lines: [
          `Job function: ${r.function}`,
          `Advertised pay is ${pct}% ${dir} in postings that ask for AI skills than in similar postings at the same level that do not`,
          `Median advertised pay: ${usdK(r.medianWithAi as number)} with AI skills, ${usdK(r.medianWithoutAi as number)} without`,
          `Postings compared: ${n(r.withAi)} ask for AI skills, ${n(r.withoutAi)} do not`,
          'Keep this caveat, in a few words: these are advertised pay ranges, not what people are paid, and they do not show that learning AI skills raises pay',
        ],
        path: '/resources/ai-skills-pay-premium',
        campaign: 'ai-pay-story',
        fallback: (link: string, short: boolean) =>
          fit(
            (t) => `${t} postings that ask for AI skills advertise ${pct}% ${dir} pay than similar ones that do not (${usdK(r.medianWithAi as number)} vs ${usdK(r.medianWithoutAi as number)} median). Advertised ranges, not what people are paid: ${link}`,
            r.function,
            textBudget(link, short),
          ),
      }
    })
}

// ---- Hot skills -----------------------------------------------------------------------------------------------------

export function skillFacts(m: SkillMarket | null): Fact[] {
  if (!m) return []
  const month = m.asOf.slice(0, 7)
  return topSkills(m, 25)
    .filter((s) => s.n >= MIN_SKILL_POSTINGS)
    .map((s) => {
      const share = fmtPct(s.share)
      const pay = s.pay && s.pay.n >= 30 ? s.pay : null
      const base = m.payBaseline && m.payBaseline.n >= 30 ? m.payBaseline : null
      return {
        key: `story-skill-${s.slug}-${month}`,
        topic: 'skill' as const,
        lines: [
          `Skill: ${s.name}`,
          `Named in ${share} of the job postings that list skills`,
          `Open postings that name it: ${n(s.n)}`,
          ...(pay ? [`Median posted yearly pay of postings that name it: ${usdK(pay.median)}${base ? `, against ${usdK(base.median)} for all postings that name a skill and state pay` : ''}`] : []),
        ],
        path: `/skills/${s.slug}`,
        campaign: 'skill-story',
        fallback: (link: string, short: boolean) =>
          fit(
            (t) => `${t} is named in ${share} of job postings that list skills, ${n(s.n)} open right now${pay ? `, with a median posted pay of ${usdK(pay.median)}` : ''}. What it pairs with: ${link}`,
            s.name,
            textBudget(link, short),
          ),
      }
    })
}

// ---- Help for people who lost a job: unemployment benefits by state --------------------------------------------------

/** The states with the most workers first, so the help posts reach the most people before the long tail. */
const BIG_STATES = ['CA', 'TX', 'NY', 'FL', 'WA', 'IL', 'PA', 'NJ', 'MA', 'GA', 'NC', 'VA', 'OH', 'MI', 'CO', 'AZ', 'MN', 'MD', 'TN', 'OR']
const bigRank = (code: string) => {
  const i = BIG_STATES.indexOf(code)
  return i < 0 ? BIG_STATES.length : i
}
const VERIFIED_LABEL = (() => {
  const d = new Date(`${UI_LAST_VERIFIED}T12:00:00Z`)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
})()

/**
 * What a state pays someone who loses a job, from the verified state unemployment data (the same figures as the benefits pages).
 * Only figures the data confirms are included; a state with neither a maximum benefit nor a maximum duration is skipped.
 */
export function helpFacts(now: Date): Fact[] {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return [...ALL_STATE_CODES]
    .sort((a, b) => bigRank(a) - bigRank(b))
    .flatMap((code) => {
      const ui = STATE_UI[code]
      const max = ui?.maxWeeklyBenefit.value ?? null
      const weeks = ui?.maxWeeks.value ?? null
      if (!ui || (max === null && weeks === null)) return []
      const name = stateName(code)
      const varies = ui.durationVaries.value === true
      const weeksLine =
        weeks === null ? null : varies ? `Maximum weeks of regular benefits: up to ${weeks}, and the number varies with the state's unemployment rate` : `Maximum weeks of regular benefits: ${weeks}`
      const fact: Fact = {
        key: `story-help-${code}-${month}`,
        topic: 'help',
        state: code,
        lines: [
          `State: ${name}`,
          ...(max !== null ? [`Maximum weekly unemployment benefit: $${n(max)}`] : []),
          ...(weeksLine ? [weeksLine] : []),
          ...(ui.waitingWeek.value === true ? ['There is a waiting week before benefits begin'] : ui.waitingWeek.value === false ? ['There is no waiting week'] : []),
          `Figures as published by the state, last verified ${VERIFIED_LABEL}`,
          'Keep this caveat, in a few words: the state decides eligibility and amounts, so people should check their state',
        ],
        path: `/unemployment-benefits/${stateSlug(code)}`,
        campaign: 'help-story',
        cites: STATE_AGENCIES[code] ? [`agency:${code}`] : [],
        fallback: (link, short) =>
          fit(
            (t) =>
              `${t} unemployment benefits${max !== null ? ` max out at $${n(max)} a week` : ''}${weeks !== null ? `${max !== null ? ', for' : ' last'} up to ${weeks} weeks` : ''}. The state decides eligibility, so check yours: ${link}`,
            name,
            textBudget(link, short),
          ),
      }
      return [fact]
    })
}

// ---- The weekly press post: one quotable number from the index -----------------------------------------------------------

export interface PressIndexSummary {
  latest: { month: string; index: number; ltuShare: number }
  yearAgo: { index: number } | null
}

/** The White-Collar Long-Search Index, with the year's change and its source, linking to /press where it is cited and downloadable. */
export function pressWeeklyFact(s: PressIndexSummary, weekKey: string): Fact {
  const level = headlineIndex(s.latest.index)
  const change = s.yearAgo ? headlineChange(s.latest.index, s.yearAgo.index) : null
  const month = indexMonthLabel(s.latest.month)
  const share = s.latest.ltuShare.toFixed(1)
  const moved = change === null || change === 0 ? '' : `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)} points from a year ago`
  return {
    key: `press-weekly-${weekKey}`,
    topic: 'press',
    lines: [
      `White-Collar Long-Search Index, ${month}: ${level} (2019 average = 100)`,
      ...(change === null ? [] : [change === 0 ? 'Unchanged from a year ago' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} points from a year ago`]),
      `Share of unemployed white-collar workers out of work 27 weeks or more: ${share}%`,
      'Source, to be named in plain words: NextChapter calculation from U.S. Census Bureau Current Population Survey microdata',
    ],
    path: '/press',
    campaign: 'press-weekly',
    fallback: (link, short) => {
      const budget = textBudget(link, short)
      const forms = [
        `White-collar long-term unemployment, ${month}: our index is ${level} (2019 = 100)${moved}. ${share}% of unemployed white-collar workers have been out 27 weeks or more. Source: Census CPS microdata. Data and how to cite: ${link}`,
        `Our White-Collar Long-Search Index, ${month}: ${level}${moved}. ${share}% of unemployed white-collar workers have been out 27 weeks or more. Source: Census CPS. ${link}`,
        `Our White-Collar Long-Search Index, ${month}: ${level}${moved}. Source: Census CPS microdata. ${link}`,
      ]
      return forms.find((f) => f.length <= budget) ?? forms[forms.length - 1]
    },
  }
}

// ---- Rotation -------------------------------------------------------------------------------------------------------

const STORY_TOPICS: Topic[] = ['ranking', 'skill', 'ai-pay', 'help']

/**
 * Topics in the order to try them: the one posted longest ago (or never) first, so the feed never runs one subject twice in a row.
 * `shift` rotates the starting order, so each channel opens on a different topic.
 */
export function topicOrder(lastTopics: Topic[], shift = 0): Topic[] {
  const start = ((shift % STORY_TOPICS.length) + STORY_TOPICS.length) % STORY_TOPICS.length
  const rotated = [...STORY_TOPICS.slice(start), ...STORY_TOPICS.slice(0, start)]
  return rotated.sort((a, b) => lastTopics.lastIndexOf(a) - lastTopics.lastIndexOf(b))
}

const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A repeatable shuffle: the same seed and items give the same order, a different seed gives a different one. Used so channels pick different filler from one pool. */
export function stableShuffle<T extends { key: string }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${a.key}`) - hash(`${seed}:${b.key}`))
}
