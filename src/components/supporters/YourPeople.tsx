import { InviteForm } from './InviteForm'
import { TodayINeed } from './TodayINeed'
import { levelLabel, relationshipLabel, type Relationship, type ShareLevel } from './levels'
import type { NeedKind } from './PartnerView'

export interface PersonRow {
  id: string
  name: string
  relationship: Relationship
  level: ShareLevel
  /** What they last did, in words, or null. */
  last: string | null
  paused?: boolean
}

// The member's side of supporters. One headline, one primary action (Invite someone),
// three parts: what would help today, who is in the corner, add someone.
export function YourPeople({ people, need, inviteOpen }: { people: PersonRow[]; need: NeedKind; inviteOpen: boolean }) {
  const close = people.filter((p) => p.level === 'close' && !p.paused)
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your people</h1>
          <p className="max-w-xl text-base text-muted-foreground">
            People do better with someone in their corner. You choose who, and exactly what each person can see.
          </p>
        </div>
        {!inviteOpen && people.length < 3 && (
          <button type="button" className="h-11 rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
            Invite someone
          </button>
        )}
      </header>

      {close.length > 0 && <TodayINeed initial={need} peopleNames={close.map((p) => p.name).join(' and ')} />}

      <section aria-labelledby="corner" className="space-y-3">
        <h2 id="corner" className="font-display text-xl font-semibold text-ink">
          In your corner
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink">
                  {p.name} <span className="font-normal text-muted-foreground">· {relationshipLabel(p.relationship)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.paused ? 'Paused. They see nothing until you turn it back on.' : `Sees: ${levelLabel(p.level)}`}
                  {p.last && !p.paused ? ` · ${p.last}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="h-9 rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted">
                  {p.paused ? 'Turn back on' : 'Pause'}
                </button>
                <button type="button" className="h-9 rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted">
                  Change
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {inviteOpen && (
        <section aria-labelledby="add" className="space-y-3">
          <h2 id="add" className="font-display text-xl font-semibold text-ink">
            Add someone
          </h2>
          <InviteForm />
          <p className="text-sm text-muted-foreground">Up to three people. They never see names, companies or messages. Remove anyone at any time.</p>
        </section>
      )}
    </>
  )
}
