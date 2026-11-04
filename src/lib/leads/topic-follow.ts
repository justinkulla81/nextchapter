// Following a topic page (a role, industry, function or place) with one click, for a signed-in member. It is the same saved
// search the email box saves (a HomepageLead of kind job_alert), keyed the same way, so a member who follows here and an
// email visitor who saves there are one row. Pure and client-safe; tests in src/test/topic-follow.test.ts.

import { cleanPublicQuery } from '@/lib/jobs/public-board'

/** The page boxes a saved search can come from (the same allowlist saveJobSearchAlert applies). */
export const TOPIC_SOURCE = /^page:(employer|title|salary|place|industry|function|college|company|ranking)$/
export const topicSource = (raw: string): string => (TOPIC_SOURCE.test(raw) ? raw : 'jobs')

export interface TopicFollowKey {
  email: string
  kind: 'job_alert'
  situation: ''
  searchQ: string
  searchLoc: string
  searchRemote: boolean
}

/** The unique key of the saved search: the email, and the search as the email box stores it (cleaned, lower-cased). */
export function topicFollowKey(email: string, q: string, loc: string): TopicFollowKey {
  const query = cleanPublicQuery({ q, loc, remote: '' })
  return { email: email.trim().toLowerCase(), kind: 'job_alert', situation: '', searchQ: query.q.toLowerCase(), searchLoc: query.loc.toLowerCase(), searchRemote: query.remote }
}

/** A topic can be followed only when it names something: an empty search is "all jobs", which the email box handles. */
export const isFollowable = (q: string, loc: string): boolean => q.trim() !== '' || loc.trim() !== ''
