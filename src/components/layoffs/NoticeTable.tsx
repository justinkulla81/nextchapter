import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { noticeDay, type PublicNotice } from '@/lib/warn/layoff-pages'
import { stateName } from '@/lib/seo/states'
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
}: {
  notices: PublicNotice[]
  caption: string
  showState?: boolean
  linkEmployer?: boolean
  page: 'state' | 'company'
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
            <tr key={n.id}>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                <time dateTime={n.noticeDate.toISOString().slice(0, 10)}>{noticeDay(n.noticeDate)}</time>
              </td>
              <th scope="row" className="px-4 py-3 font-medium text-navy">
                {linkEmployer && n.slug ? (
                  <Link href={`/layoffs/company/${n.slug}`} className="hover:text-brand hover:underline">{n.employer}</Link>
                ) : (
                  n.employer
                )}
                {n.effectiveDate && (
                  <span className="block text-xs font-normal text-muted-foreground">Takes effect {noticeDay(n.effectiveDate)}</span>
                )}
              </th>
              {showState && <td className="px-4 py-3 whitespace-nowrap">{stateName(n.state)}</td>}
              <td className="px-4 py-3">{n.place ?? '—'}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The local workforce boards matched to these notices, each once, with its job-center finder. */
export function BoardList({ notices, page }: { notices: PublicNotice[]; page: 'state' | 'company' }) {
  const boards = new Map<string, { board: NonNullable<PublicNotice['board']>; state: string; places: Set<string> }>()
  for (const n of notices) {
    if (!n.board) continue
    const b = boards.get(n.board.id) ?? { board: n.board, state: n.state, places: new Set<string>() }
    if (n.place) b.places.add(n.place)
    boards.set(n.board.id, b)
  }
  if (boards.size === 0) return <p className="text-sm text-muted-foreground">No local workforce board has been matched to these notices yet.</p>
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
