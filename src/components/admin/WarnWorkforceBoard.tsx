import { jobCentersUrl, stateBoardsUrl } from '@/lib/workforce/directory'

export interface WorkforceBoardSummary {
  id: string
  name: string
  website: string | null
  zip: string | null
  detailsUrl: string | null
  directorName: string | null
  directorTitle: string | null
  directorEmail: string | null
  directorPhone: string | null
  chairName: string | null
  chairEmail: string | null
  chairPhone: string | null
}

function Contact({ role, name, email, phone }: { role: string; name: string | null; email: string | null; phone: string | null }) {
  if (!name && !email) return null
  return (
    <p className="text-muted-foreground">
      <span className="text-foreground">{name ?? role}</span>
      {name && <span> · {role}</span>}
      {email && (
        <>
          {' · '}
          <a href={`mailto:${email}`} className="hover:underline">{email}</a>
        </>
      )}
      {phone && (
        <>
          {' · '}
          <a href={`tel:${phone}`} className="whitespace-nowrap hover:underline">{phone}</a>
        </>
      )}
    </p>
  )
}

/**
 * The local workforce development board (WIOA) for a WARN notice: the
 * public body that runs rapid response for that layoff, its director and
 * chair, and its American Job Centers — the partners on the ground.
 */
export function WarnWorkforceBoard({
  board, match, state, noticeZip,
}: {
  board: WorkforceBoardSummary | null
  match: string | null
  state: string | null
  noticeZip: string | null
}) {
  if (!board) {
    if (!state) return <span className="text-xs text-muted-foreground">—</span>
    return (
      <a href={stateBoardsUrl(state)} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
        Find {state} board →
      </a>
    )
  }
  const site = board.website ?? board.detailsUrl
  return (
    <div className="min-w-56 max-w-80 space-y-0.5 text-xs">
      <p className="font-medium">
        {site ? (
          <a href={site} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{board.name}</a>
        ) : (
          board.name
        )}
        {match === 'statewide' && <span className="ml-1 font-normal text-muted-foreground" title="This state runs one board for every county">(statewide)</span>}
      </p>
      <Contact role={board.directorTitle ?? 'Director'} name={board.directorName} email={board.directorEmail} phone={board.directorPhone} />
      <Contact role="Board chair" name={board.chairName} email={board.chairEmail} phone={board.chairPhone} />
      <p className="flex flex-wrap gap-x-2">
        <a href={jobCentersUrl(noticeZip ?? board.zip, state ?? '')} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          Job centers (partners)
        </a>
        {board.detailsUrl && (
          <a href={board.detailsUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">
            Directory listing
          </a>
        )}
      </p>
    </div>
  )
}
