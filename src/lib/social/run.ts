import 'server-only'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { CHANNELS, type ChannelId } from '@/lib/social/channels'
import { weeklyLayoffPost, type SocialPost } from '@/lib/social/posts'

const STATE_PATH = 'social/posted.json.gz'

interface PostedState {
  v: 1
  /** `<post key>:<channel>` for every post sent. */
  sent: string[]
}

export interface SocialRunResult {
  dryRun: boolean
  posts: { key: string; text: string; channels: { channel: ChannelId; status: 'sent' | 'already-sent' | 'would-send' | 'not-configured' | 'failed'; ref?: string; error?: string }[] }[]
}

const on = (name: string) => process.env[name] === '1'

/**
 * Posts aggregate data findings to Bluesky and X. Nothing is sent unless SOCIAL_POSTING_ENABLED=1 (a dry run otherwise,
 * so the route can be called to preview); X also needs X_POSTING_ENABLED=1 because X bills API usage. A post is sent to
 * a channel at most once (state kept in the syndication-state bucket), and one channel failing never blocks the other.
 */
export async function runSocialPosts(now = new Date()): Promise<SocialRunResult> {
  const dryRun = !on('SOCIAL_POSTING_ENABLED')
  const notices = (await getPublicNotices().catch(() => [])).filter((x) => x.noticeDateKnown)
  const candidates: { post: SocialPost; channels: ChannelId[] }[] = []
  const layoff = (utm: string) => weeklyLayoffPost(notices, now, utm)
  for (const c of CHANNELS) {
    const post = layoff(`utm_source=${c.id}&utm_medium=social&utm_campaign=weekly-layoffs`)
    if (post) candidates.push({ post, channels: [c.id] })
  }

  const state = (await readJsonGz<PostedState>(STATE_BUCKET, STATE_PATH).catch(() => null)) ?? { v: 1 as const, sent: [] }
  const sent = new Set(state.sent)
  const result: SocialRunResult = { dryRun, posts: [] }

  for (const { post, channels } of candidates) {
    const row: SocialRunResult['posts'][number] = { key: post.key, text: post.text, channels: [] }
    for (const channel of channels) {
      const id = `${post.key}:${channel}`
      const ch = CHANNELS.find((c) => c.id === channel)!
      const configured = ch.ready()
      if (sent.has(id)) row.channels.push({ channel, status: 'already-sent' })
      else if (!configured) row.channels.push({ channel, status: 'not-configured' })
      else if (dryRun) row.channels.push({ channel, status: 'would-send' })
      else {
        try {
          const ref = await ch.post(post.text, id)
          sent.add(id)
          // Save after every send so a later failure can never cause a repeat post.
          await writeJsonGz(STATE_BUCKET, STATE_PATH, { v: 1, sent: [...sent] } satisfies PostedState)
          row.channels.push({ channel, status: 'sent', ref })
        } catch (e) {
          row.channels.push({ channel, status: 'failed', error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
    result.posts.push(row)
  }
  return result
}
