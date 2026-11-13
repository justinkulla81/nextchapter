import type { FeedPosting } from '@/lib/jobs/gov-feed-core'

// What a government job system needs to provide to the weekly board feed (gov-board-feed.ts): Workday, Oracle Recruiting
// Cloud and any other system with a public job list and job detail. No database access.

export interface BoardPost { key: string; title: string; data?: unknown }

export interface BoardAdapter<B> {
  /** Stored on the row: who added it. Never 'ncrawl'. */
  addedBy: string
  sourceName: string
  boards: B[]
  /** Rows of this board start with this url prefix. */
  prefix: (b: B) => string
  urlOf: (b: B, post: BoardPost) => string
  /** Every open job of the board; complete is false when the list could not be read to the end. */
  list: (b: B, deadline: number) => Promise<{ posts: BoardPost[]; complete: boolean }>
  detail: (b: B, post: BoardPost) => Promise<FeedPosting | null>
  /** Titles worth fetching. */
  worth: (title: string) => boolean
}
