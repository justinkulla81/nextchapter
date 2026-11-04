import { SITE_URL } from '@/lib/seo/facts'
import { fmtPct, MIN_SKILL_POSTINGS, topSkills, type SkillMarket } from '@/lib/skills/market'
import type { FunctionPremium } from '@/lib/market/ai-pay-premium'
import type { RankingIndexEntry } from '@/lib/rankings/types'
import { textBudget } from '@/lib/social/posts'

/**
 * A fact is one verified finding a post can be written from: the numbers, where to read more and a plain template for the day the
 * writer is off. Nothing here talks; the writer (writer.ts) turns the lines into a post and the checker (validate.ts) rejects a draft
 * that adds a number.
 */
export type Topic = 'layoff' | 'ranking' | 'ai-pay' | 'skill'

export interface Fact {
  /** Stable id, so a fact is posted once per edition and channel. */
  key: string
  topic: Topic
  /** Plain statements the post may use. Every number in a post must come from these, written the way the post should write it. */
  lines: string[]
  /** Page the post links to, with a leading slash. */
  path: string
  campaign: string
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

// ---- Rotation -------------------------------------------------------------------------------------------------------

const STORY_TOPICS: Topic[] = ['ranking', 'skill', 'ai-pay']

/** Topics in the order to try them: the one posted longest ago (or never) first, so the feed never runs one subject twice in a row. */
export function topicOrder(lastTopics: Topic[]): Topic[] {
  return [...STORY_TOPICS].sort((a, b) => lastTopics.lastIndexOf(a) - lastTopics.lastIndexOf(b))
}
