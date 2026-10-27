import Link from 'next/link'

/** "Get new notices by RSS": one line linking a page to the feed for its state or industry, and to the list of every feed. */
export function FeedLine({ feed, label = 'Get new notices by RSS' }: { feed: string; label?: string }) {
  return (
    <>
      <a href={feed} type="application/rss+xml" className="text-brand underline underline-offset-4">{label}</a>
      {' · '}
      <Link href="/feeds" className="text-brand underline underline-offset-4">all feeds</Link>
    </>
  )
}
