import Link from 'next/link'
import { type Author, DEFAULT_AUTHOR, authorPath } from '@/lib/seo/authors'

export interface Reviewer {
  name: string
  credential: string
}

/** "October 5, 2026" from an ISO date, read as a calendar date (no timezone shift). */
export function formatContentDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/**
 * "By Justin Kulla · Last updated October 5, 2026", with an optional
 * "Reviewed by" line. Shown on every guide, insight, news take and report.
 * The reviewer line renders only when a real reviewer is set on the content.
 */
export function AuthorByline({
  updated,
  author = DEFAULT_AUTHOR,
  reviewedBy,
  className = 'mt-3',
}: {
  updated: string
  author?: Author
  reviewedBy?: Reviewer | null
  className?: string
}) {
  return (
    <div className={`${className} text-sm text-muted-foreground`}>
      <p>
        By{' '}
        <Link href={authorPath(author)} rel="author" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
          {author.name}
        </Link>
        <span aria-hidden="true"> · </span>
        <span>
          Last updated <time dateTime={updated.slice(0, 10)}>{formatContentDate(updated)}</time>
        </span>
      </p>
      {reviewedBy && (
        <p className="mt-1">
          Reviewed by <span className="font-medium text-foreground">{reviewedBy.name}</span>, {reviewedBy.credential}
        </p>
      )}
    </div>
  )
}
