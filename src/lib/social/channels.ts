import 'server-only'
import {
  blueskyConfigured, discordConfigured, facebookConfigured, mastodonConfigured, postBluesky, postDiscord, postFacebook, postMastodon,
  postSlack, postTelegram, postThreads, postX, slackConfigured, telegramConfigured, threadsConfigured, xConfigured,
} from '@/lib/social/clients'

export type ChannelId = 'bluesky' | 'x' | 'mastodon' | 'telegram' | 'discord' | 'slack' | 'threads' | 'facebook'

export interface Channel {
  id: ChannelId
  /** Keys are present, and for X the billing switch is on. */
  ready: () => boolean
  post: (text: string, key: string) => Promise<string>
  /** Gets each qualifying WARN filing automatically. X does not: every X post is billed ($0.20 with a link), so filings go there by hand. */
  autoFilings: boolean
}

const on = (name: string) => process.env[name] === '1'

export const CHANNELS: Channel[] = [
  { id: 'bluesky', ready: blueskyConfigured, post: (t) => postBluesky(t), autoFilings: true },
  { id: 'mastodon', ready: mastodonConfigured, post: (t, k) => postMastodon(t, k), autoFilings: true },
  { id: 'telegram', ready: telegramConfigured, post: (t) => postTelegram(t), autoFilings: true },
  { id: 'discord', ready: discordConfigured, post: (t) => postDiscord(t), autoFilings: true },
  { id: 'slack', ready: slackConfigured, post: (t) => postSlack(t), autoFilings: true },
  { id: 'threads', ready: threadsConfigured, post: (t) => postThreads(t), autoFilings: true },
  { id: 'facebook', ready: facebookConfigured, post: (t) => postFacebook(t), autoFilings: true },
  { id: 'x', ready: () => xConfigured() && on('X_POSTING_ENABLED'), post: (t) => postX(t), autoFilings: false },
]
