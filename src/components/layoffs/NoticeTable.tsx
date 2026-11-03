import { Fragment } from 'react'
import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { noticeDay, type PublicNotice } from '@/lib/warn/layoff-pages'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getStateBoards } from '@/lib/seo/workforce-pages'
import { jobCentersUrl } from '@/lib/workforce/directory'

/**
 * WARN notices as a table: date, employer, place, workers, type, source.
 * `showState` adds the state column (company pages span states);
 * `linkEmployer` links each employer to its company page (state pages).
 */
export function NoticeTable({
  notices,
  caption,
  showState = false,
  linkEmployer = false,
  page,
  placeHref,
  statements,
}: {
  notices: PublicNotice[]
  caption: string
  showState?: boolean
  linkEmployer?: boolean
  page: 'state' | 'company'
  /** Link for a notice's city or county, when that place has its own page. */
  placeHref?: (place: string | null) => string | null
  /** Approved employer statements by notice id, shown under the notice. The filing itself is never changed. */
  statements?: Record<string, { body: string; authorTitle: string; approvedAt: Date; employer: string }>
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Notice date</th>
            <th scope="col" className="px-4 py-3 font-medium">Employer</th>
            {showState && <th scope="col" className="px-4 py-3 font-medium">State</th>}
            <th scope="col" className="px-4 py-3 font-medium">City or county</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Workers</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            <th scope="col" className="px-4 py-3 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {notices.map((n) => (
            <Fragment key={n.id}>
            <tr>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                {n.noticeDateKnown ? (
                  <time dateTime={n.noticeDate.toISOString().slice(0, 10)}>{noticeDay(n.noticeDate)}</time>
                ) : n.effectiveDate ? (
                  <span title="This state publishes the effective date, not the filing date"><span className="text-xs">Effective </span><time dateTime={n.effectiveDate.toISOString().slice(0, 10)}>{noticeDay(n.effectiveDate)}</time></span>
                ) : null}
              </td>
              <th scope="row" className="px-4 py-3 font-medium text-navy">
                {linkEmployer && n.slug ? (
                  <Link href={`/layoffs/company/${n.slug}`} className="hover:text-brand hover:underline">{n.employer}</Link>
                ) : (
                  n.employer
                )}
                {n.noticeDateKnown && n.effectiveDate && (
                  <span className="block text-xs font-normal text-muted-foreground">Takes effect {noticeDay(n.effectiveDate)}</span>
                )}
              </th>
              {showState && <td className="px-4 py-3 whitespace-nowrap">{stateName(n.state)}</td>}
              <td className="px-4 py-3">{(() => { const h = placeHref?.(n.place); return h && n.place ? <Link href={h} className="hover:text-brand hover:underline">{n.place}</Link> : (n.place ?? '—') })()}</td>
              <td className="px-4 py-3 text-right tabular-nums">{n.workers != null ? n.workers.toLocaleString() : '—'}</td>
              <td className="px-4 py-3">{n.type ?? '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {n.sourceUrl ? (
                  <TrackedLink
                    href={n.sourceUrl}
                    event="layoff_source_clicked"
                    properties={{ noticeId: n.id, state: n.state, page }}
                    className="text-primary hover:underline"
                  >
                    State record
                  </TrackedLink>
                ) : (
                  'State record'
                )}
              </td>
            </tr>
            {statements?.[n.id] && (
              <tr className="bg-off-white">
                <td colSpan={showState ? 7 : 6} className="px-4 py-3 text-sm">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Statement from {statements[n.id].employer}, {noticeDay(statements[n.id].approvedAt)}</p>
                  <p className="mt-1 text-navy">{statements[n.id].body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{statements[n.id].authorTitle}. Added by the employer and reviewed by NextChapter. The state filing above is unchanged.</p>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The local workforce boards matched to these notices, each once, with its job-center finder. */
export async function BoardList({ notices, page }: { notices: PublicNotice[]; page: 'state' | 'company' }) {
  const boards = new Map<string, { board: NonNullable<PublicNotice['board']>; state: string; places: Set<string> }>()
  for (const n of notices) {
    if (!n.board) continue
    const b = boards.get(n.board.id) ?? { board: n.board, state: n.state, places: new Set<string>() }
    if (n.place) b.places.add(n.place)
    boards.set(n.board.id, b)
  }
  if (boards.size === 0) return <p className="text-sm text-muted-foreground">No local workforce board has been matched to these notices yet.</p>
  // The board's own page on this site, when it has one.
  const pageSlug = new Map<string, string>()
  for (const state of new Set([...boards.values()].map((b) => b.state))) for (const b of await getStateBoards(state).catch(() => [])) pageSlug.set(b.id, b.slug)
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {[...boards.values()].sort((a, b) => a.board.name.localeCompare(b.board.name)).map(({ board, state, places }) => (
        <li key={board.id} className="rounded-xl border border-border bg-white p-4 text-sm">
          <p className="font-medium text-navy">{board.name}</p>
          {places.size > 0 && <p className="mt-1 text-xs text-muted-foreground">For notices in {[...places].slice(0, 4).join(', ')}{places.size > 4 ? ' and more' : ''}</p>}
          <p className="mt-2 flex flex-wrap gap-x-3">
            <TrackedLink
              href={jobCentersUrl(board.zip, state)}
              event="job_center_link_clicked"
              properties={{ boardId: board.id, state, page }}
              className="text-primary hover:underline"
            >
              Find a job center
            </TrackedLink>
            {pageSlug.get(board.id) && (
              <Link href={`/workforce-boards/${stateSlug(state)}/${pageSlug.get(board.id)}`} className="text-primary hover:underline">
                Board page: centers, jobs and notices
              </Link>
            )}
            {board.website && (
              <TrackedLink href={board.website} event="workforce_board_link_clicked" properties={{ boardId: board.id, state, page }} className="text-primary hover:underline">
                Board website
              </TrackedLink>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}
