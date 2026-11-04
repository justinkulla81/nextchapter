import 'server-only'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadAiPayPremium } from '@/lib/market/ai-pay-premium-data'
import { readRankingIndex } from '@/lib/rankings/store'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { CHANNELS, type ChannelId } from '@/lib/social/channels'
import { aiPayFacts, factLink, rankingFacts, skillFacts, topicOrder, type Fact, type Topic } from '@/lib/social/facts'
import { FILING_RULES, loadLayoffQueue, readLedger, writeLedger, type LayoffItem } from '@/lib/social/filings'
import { gapPassed, inWindow, nextKind, storyDue, streamDay, type Kind } from '@/lib/social/pace'
import { LINK_TOKEN } from '@/lib/social/validate'
import { writePost } from '@/lib/social/writer'

const STATE_PATH = 'social/stream-state.json.gz'
const DAY_MS = 86_400_000
const KEEP_RECENT = 12

interface StreamState {
  v: 1
  lastAt: string | null
  lastKind: Kind | null
  /** The stream day (it starts with the posting window) the story count belongs to. */
  day: string
  storiesToday: number
  /** Topics of the stories posted, oldest first, for the rotation. */
  topics: Topic[]
  /** `<story key>:<channel>` -> ISO time sent. Layoffs are kept in the layoff ledger (filings.ts). */
  sent: Record<string, string>
  /** The last posts, without their links, so the writer opens the next one differently. */
  recent: string[]
}

export interface StreamResult {
  dryRun: boolean
  skipped?: 'no-channels' | 'outside-window' | 'gap' | 'nothing-due' | 'nothing-to-post' | 'preview-hourly'
  kind?: Kind
  factKey?: string
  topic?: Topic
  writer?: 'claude' | 'template' | 'preview'
  text?: string
  results: { channel: ChannelId; status: 'sent' | 'would-send' | 'failed'; ref?: string; error?: string }[]
}

const readState = async (): Promise<StreamState> =>
  (await readJsonGz<StreamState>(STATE_BUCKET, STATE_PATH).catch(() => null)) ?? { v: 1, lastAt: null, lastKind: null, day: '', storiesToday: 0, topics: [], sent: {}, recent: [] }

const sentInLastDay = (sent: Record<string, string>, channel: ChannelId, now: Date) =>
  Object.entries(sent).filter(([k, at]) => k.endsWith(`:${channel}`) && now.getTime() - Date.parse(at) < DAY_MS).length

async function storiesFor(topic: Topic, now: Date): Promise<Fact[]> {
  if (topic === 'ranking') return rankingFacts(await readRankingIndex().catch(() => []), now)
  if (topic === 'skill') return skillFacts(await loadSkillsMarket().catch(() => null))
  if (topic === 'ai-pay') return aiPayFacts(await loadAiPayPremium().catch(() => []), now)
  return []
}

/**
 * One tick of the social stream, run every five minutes. Posts at most one thing, inside the posting window and never closer than
 * GAP_MINUTES to the last post. Every layoff is posted, newest first, and each layoff post is followed by a non-layoff post (a hot
 * skill, a list, a pay finding), so layoffs never come in a burst. With no layoffs waiting it still posts a few stories a day.
 * Each post is written from one verified fact (writer.ts); if the writer is off or its draft breaks a rule, the fact's plain
 * template is used. A dry run unless SOCIAL_POSTING_ENABLED=1: it previews the next post with the template and writes nothing.
 */
export async function runSocialStream(now = new Date()): Promise<StreamResult> {
  const dryRun = process.env.SOCIAL_POSTING_ENABLED !== '1'
  const result: StreamResult = { dryRun, results: [] }
  const channels = CHANNELS.filter((c) => c.autoFilings && c.ready())
  if (!channels.length) return { ...result, skipped: 'no-channels' }
  if (!inWindow(now)) return { ...result, skipped: 'outside-window' }
  // A preview writes nothing, so it would repeat every tick: once an hour is enough.
  if (dryRun && now.getUTCMinutes() >= 5) return { ...result, skipped: 'preview-hourly' }

  const state = await readState()
  if (state.day !== streamDay(now)) { state.day = streamDay(now); state.storiesToday = 0 }
  if (!dryRun && !gapPassed(now, state.lastAt)) return { ...result, skipped: 'gap' }

  const ledger = await readLedger()
  const xRule = FILING_RULES.x
  const layoffChannels = (item: LayoffItem) =>
    channels.filter((c) => {
      if (ledger.sent[`${item.id}:${c.id}`]) return false
      if (c.id === 'x' && xRule) return (item.workers ?? 0) >= xRule.minWorkers && sentInLastDay(ledger.sent, 'x', now) < xRule.perDay
      return true
    })
  // X is billed per post, so it gets one story a day at most.
  const storyChannels = (f: Fact) => channels.filter((c) => !state.sent[`${f.key}:${c.id}`] && (c.id !== 'x' || sentInLastDay(state.sent, 'x', now) < 1))

  const loadLayoff = async (): Promise<LayoffItem | null> => (await loadLayoffQueue(now)).find((i) => layoffChannels(i).length) ?? null
  const loadStory = async (): Promise<Fact | null> => {
    for (const topic of topicOrder(state.topics)) {
      const f = (await storiesFor(topic, now)).find((x) => storyChannels(x).length)
      if (f) return f
    }
    return null
  }

  let layoff: LayoffItem | null = null
  let story: Fact | null = null
  let kind: Kind | null
  if (state.lastKind === 'layoff') kind = 'story'
  else {
    layoff = await loadLayoff()
    kind = nextKind({ lastKind: state.lastKind, layoffWaiting: !!layoff, storyIsDue: storyDue(now, state.storiesToday) })
  }
  if (!kind) return { ...result, skipped: 'nothing-due' }
  if (kind === 'story') {
    story = await loadStory()
    // No story left to post: do not hold a waiting layoff back for it.
    if (!story) { layoff ??= await loadLayoff(); kind = layoff ? 'layoff' : null }
  }
  const fact = kind === 'story' ? story : layoff?.fact ?? null
  if (!kind || !fact) return { ...result, skipped: 'nothing-to-post' }

  const targets = kind === 'layoff' ? layoffChannels(layoff as LayoffItem) : storyChannels(fact)
  const draft = dryRun ? ({ by: 'template', body: null, reason: 'preview' } as const) : await writePost(fact, state.recent)
  Object.assign(result, { kind, factKey: fact.key, topic: fact.topic, writer: dryRun ? 'preview' : draft.by })

  let anySent = false
  for (const c of targets) {
    const link = factLink(fact, c.id)
    const text = draft.body ? draft.body.replace(LINK_TOKEN, link) : fact.fallback(link, c.id === 'x')
    result.text = text
    if (dryRun) { result.results.push({ channel: c.id, status: 'would-send' }); continue }
    try {
      const ref = await c.post(text, `${fact.key}:${c.id}`)
      if (kind === 'layoff') { ledger.sent[`${(layoff as LayoffItem).id}:${c.id}`] = now.toISOString(); await writeLedger(ledger) }
      else state.sent[`${fact.key}:${c.id}`] = now.toISOString()
      anySent = true
      result.results.push({ channel: c.id, status: 'sent', ref })
      captureServerEvent('cron', 'social_post_sent', { channel: c.id, kind: kind === 'layoff' ? 'layoff' : 'data_story', topic: fact.topic, factKey: fact.key, writer: draft.by, ref })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      result.results.push({ channel: c.id, status: 'failed', error })
      captureServerEvent('cron', 'social_post_failed', { channel: c.id, kind: kind === 'layoff' ? 'layoff' : 'data_story', topic: fact.topic, factKey: fact.key, error })
    }
  }

  if (!dryRun) {
    // A failed attempt still starts the gap, so a post that keeps failing is retried at the pace of the stream, not every tick.
    state.lastAt = now.toISOString()
    if (anySent) {
      state.lastKind = kind
      if (kind === 'story') { state.storiesToday++; state.topics = [...state.topics, fact.topic].slice(-9) }
      const first = result.text ?? ''
      state.recent = [first.replace(/https?:\/\/\S+/, '').replace(LINK_TOKEN, '').trim(), ...state.recent].slice(0, KEEP_RECENT)
    }
    // Story keys carry their month, so entries older than this can never come up again.
    for (const [k, at] of Object.entries(state.sent)) if (now.getTime() - Date.parse(at) > 70 * DAY_MS) delete state.sent[k]
    await writeJsonGz(STATE_BUCKET, STATE_PATH, state)
  }
  return result
}
