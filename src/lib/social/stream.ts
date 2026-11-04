import 'server-only'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadAiPayPremium } from '@/lib/market/ai-pay-premium-data'
import { readRankingIndex } from '@/lib/rankings/store'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { CHANNELS, type Channel, type ChannelId } from '@/lib/social/channels'
import { aiPayFacts, factLink, rankingFacts, skillFacts, stableShuffle, topicOrder, type Fact, type Topic } from '@/lib/social/facts'
import { FILING_RULES, loadLayoffQueue, readLedger, writeLedger, type Ledger, type LayoffItem } from '@/lib/social/filings'
import { baselineStories, gapMinutes, gapPassed, inWindow, nextKind, storyDue, streamDay, tickSlot, type Kind } from '@/lib/social/pace'
import { LINK_TOKEN } from '@/lib/social/validate'
import { writePost } from '@/lib/social/writer'

const DAY_MS = 86_400_000
const KEEP_RECENT = 12

/** Each channel keeps its own state: its own pace, its own run of topics, its own last posts. */
interface ChannelState {
  v: 1
  lastAt: string | null
  lastKind: Kind | null
  /** The stream day (it starts with the posting window) the story count belongs to. */
  day: string
  storiesToday: number
  /** Topics of the stories posted, oldest first, for the rotation. */
  topics: Topic[]
  /** `<story key>` -> ISO time sent. Layoffs are kept in the layoff ledger (filings.ts). */
  sent: Record<string, string>
  /** The last posts, without their links, so the writer opens the next one differently. */
  recent: string[]
}

export interface ChannelResult {
  channel: ChannelId
  skipped?: 'other-slot' | 'gap' | 'nothing-due' | 'nothing-to-post'
  kind?: Kind
  factKey?: string
  topic?: Topic
  writer?: 'claude' | 'template' | 'preview'
  text?: string
  status?: 'sent' | 'would-send' | 'failed'
  ref?: string
  error?: string
}

export interface StreamResult {
  dryRun: boolean
  skipped?: 'no-channels' | 'outside-window' | 'preview-hourly'
  channels: ChannelResult[]
}

const statePath = (id: ChannelId) => `social/stream-${id}.json.gz`
const readState = async (id: ChannelId): Promise<ChannelState> =>
  (await readJsonGz<ChannelState>(STATE_BUCKET, statePath(id)).catch(() => null)) ?? { v: 1, lastAt: null, lastKind: null, day: '', storiesToday: 0, topics: [], sent: {}, recent: [] }

const sentInLastDay = (sent: Record<string, string>, channel: ChannelId, now: Date) =>
  Object.entries(sent).filter(([k, at]) => k.endsWith(`:${channel}`) && now.getTime() - Date.parse(at) < DAY_MS).length

async function storiesFor(topic: Topic, now: Date): Promise<Fact[]> {
  if (topic === 'ranking') return rankingFacts(await readRankingIndex().catch(() => []), now)
  if (topic === 'skill') return skillFacts(await loadSkillsMarket().catch(() => null))
  if (topic === 'ai-pay') return aiPayFacts(await loadAiPayPremium().catch(() => []), now)
  return []
}

interface Shared {
  dryRun: boolean
  ledger: Ledger
  getQueue: () => Promise<LayoffItem[]>
}

/**
 * One tick for one channel. Each channel runs its own stream: it posts at most one thing, at its own gap, on its own five-minute slot,
 * and every post is written separately, so the same layoff reads differently on Bluesky and on X. The layoff order differs (Bluesky
 * newest first, X biggest first), and so do the filler stories (a different topic to start with and a different pick from each pool).
 */
async function runChannel(c: Channel, index: number, now: Date, shared: Shared): Promise<ChannelResult> {
  const { dryRun, ledger } = shared
  const out: ChannelResult = { channel: c.id }
  const state = await readState(c.id)
  if (state.day !== streamDay(now)) { state.day = streamDay(now); state.storiesToday = 0 }
  if (!dryRun && !tickSlot(now, index)) return { ...out, skipped: 'other-slot' }
  if (!dryRun && !gapPassed(now, state.lastAt, gapMinutes(c.id))) return { ...out, skipped: 'gap' }

  const xRule = c.id === 'x' ? FILING_RULES.x : undefined
  const layoffOk = (i: LayoffItem) =>
    !ledger.sent[`${i.id}:${c.id}`] && (!xRule || ((i.workers ?? 0) >= xRule.minWorkers && sentInLastDay(ledger.sent, 'x', now) < xRule.perDay))
  const loadLayoff = async (): Promise<LayoffItem | null> => {
    const queue = (await shared.getQueue()).filter(layoffOk)
    // X is billed per post and only gets the big ones, so it leads with the biggest; the other channels lead with the newest.
    return (c.id === 'x' ? [...queue].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0)) : queue)[0] ?? null
  }
  const perDay = baselineStories(c.id)
  const loadStory = async (): Promise<Fact | null> => {
    if (state.storiesToday >= perDay) return null
    for (const topic of topicOrder(state.topics, index)) {
      const pool = (await storiesFor(topic, now)).filter((x) => !state.sent[x.key])
      const f = (index === 0 ? pool : stableShuffle(pool, `${c.id}:${streamDay(now)}`))[0]
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
    kind = nextKind({ lastKind: state.lastKind, layoffWaiting: !!layoff, storyIsDue: storyDue(now, state.storiesToday, perDay) })
  }
  if (!kind) return { ...out, skipped: 'nothing-due' }
  if (kind === 'story') {
    story = await loadStory()
    // No story left to post (or this channel's story cap is reached): do not hold a waiting layoff back for it.
    if (!story) { layoff ??= await loadLayoff(); kind = layoff ? 'layoff' : null }
  }
  const fact = kind === 'story' ? story : layoff?.fact ?? null
  if (!kind || !fact) return { ...out, skipped: 'nothing-to-post' }

  const draft = dryRun ? ({ by: 'template', body: null, reason: 'preview' } as const) : await writePost(fact, state.recent, c.id)
  const link = factLink(fact, c.id)
  const text = draft.body ? draft.body.replace(LINK_TOKEN, link) : fact.fallback(link, c.id === 'x')
  const base = { ...out, kind, factKey: fact.key, topic: fact.topic, writer: dryRun ? ('preview' as const) : draft.by, text }
  if (dryRun) return { ...base, status: 'would-send' }

  const eventKind = kind === 'layoff' ? 'layoff' : 'data_story'
  let result: ChannelResult
  try {
    const ref = await c.post(text, `${fact.key}:${c.id}`)
    if (kind === 'layoff') { ledger.sent[`${(layoff as LayoffItem).id}:${c.id}`] = now.toISOString(); await writeLedger(ledger) }
    else state.sent[fact.key] = now.toISOString()
    state.lastKind = kind
    if (kind === 'story') { state.storiesToday++; state.topics = [...state.topics, fact.topic].slice(-9) }
    state.recent = [text.replace(/https?:\/\/\S+/, '').trim(), ...state.recent].slice(0, KEEP_RECENT)
    result = { ...base, status: 'sent', ref }
    captureServerEvent('cron', 'social_post_sent', { channel: c.id, kind: eventKind, topic: fact.topic, factKey: fact.key, writer: draft.by, ref })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    result = { ...base, status: 'failed', error }
    captureServerEvent('cron', 'social_post_failed', { channel: c.id, kind: eventKind, topic: fact.topic, factKey: fact.key, error })
  }
  // A failed attempt still starts the gap, so a post that keeps failing is retried at the pace of the stream, not every tick.
  state.lastAt = now.toISOString()
  // Story keys carry their month, so entries older than this can never come up again.
  for (const [k, at] of Object.entries(state.sent)) if (now.getTime() - Date.parse(at) > 70 * DAY_MS) delete state.sent[k]
  await writeJsonGz(STATE_BUCKET, statePath(c.id), state)
  return result
}

/**
 * The social stream, run every five minutes inside the posting window. Every layoff is posted, and each layoff post is followed by a
 * non-layoff post (a hot skill, a list, a pay finding), so layoffs never come in a burst; with no layoffs waiting a few stories still
 * go out a day. Each channel runs its own stream (runChannel), so wording, order and filler differ between channels. Each post is
 * written from one verified fact (writer.ts); if the writer is off or its draft breaks a rule, the fact's plain template is used.
 * A dry run unless SOCIAL_POSTING_ENABLED=1: it previews each channel's next post with the template and writes nothing.
 */
export async function runSocialStream(now = new Date()): Promise<StreamResult> {
  const dryRun = process.env.SOCIAL_POSTING_ENABLED !== '1'
  const ready = CHANNELS.filter((c) => c.autoFilings && c.ready())
  if (!ready.length) return { dryRun, skipped: 'no-channels', channels: [] }
  if (!inWindow(now)) return { dryRun, skipped: 'outside-window', channels: [] }
  // A preview writes nothing, so it would repeat every tick: once an hour is enough.
  if (dryRun && now.getUTCMinutes() >= 5) return { dryRun, skipped: 'preview-hourly', channels: [] }

  let queue: Promise<LayoffItem[]> | null = null
  const shared: Shared = { dryRun, ledger: await readLedger(), getQueue: () => (queue ??= loadLayoffQueue(now)) }
  const channels: ChannelResult[] = []
  // One after the other: they share the layoff ledger, and one channel failing must not stop another.
  for (const c of ready) {
    channels.push(await runChannel(c, CHANNELS.indexOf(c), now, shared).catch((e): ChannelResult => ({ channel: c.id, status: 'failed', error: e instanceof Error ? e.message : String(e) })))
  }
  return { dryRun, channels }
}
