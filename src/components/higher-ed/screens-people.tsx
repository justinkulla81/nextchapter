import Link from 'next/link'
import { HiddenMembersNote } from '@/components/plans/HiddenMembersNote'
import { ChevronDown, Users } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { NEED_CATEGORIES, PEOPLE_TAKE, TRACKS, peopleCrm, type CrmPerson, type NeedKey, type TrackKey } from '@/lib/workforce/people-crm'
import { captureServerEvent } from '@/lib/posthog/server'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { ParticipantForm } from './HubForms'

// Program › People: everyone the program helps, by track (outplacement, retraining, moving here, new graduates,
// career pivot, employed and growing, job seekers), with the benefits each person is matched to and why.
// Replaces the plain Participants table. Rules and data use: src/lib/workforce/people-crm.ts.

type Props = { ctx: WorkspaceContext; searchParams: { q?: string; track?: string; need?: string }; base: string }

const STAGE: Record<string, string> = { EXPLORING: 'Exploring', PREPARING: 'Preparing', APPLYING: 'Applying', INTERVIEWING: 'Interviewing', OFFER: 'Has an offer', LANDED: 'Landed', PAUSED: 'Paused' }
const trackLabel = (k: TrackKey) => TRACKS.find((t) => t.key === k)!.label
const needLabel = (k: NeedKey) => NEED_CATEGORIES.find((n) => n.key === k)!.label

export async function HubPeople({ ctx, searchParams, base }: Props) {
  const slug = ctx.institution.slug
  const q = searchParams.q?.trim() || undefined
  const track = TRACKS.some((t) => t.key === searchParams.track) ? (searchParams.track as TrackKey) : null
  const need = NEED_CATEGORIES.some((n) => n.key === searchParams.need) ? (searchParams.need as NeedKey) : null
  const [people, companies] = await Promise.all([
    peopleCrm(ctx.institution.id, { q }),
    ctx.readOnly ? Promise.resolve([]) : prisma.memberCompany.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const shown = people.filter((p) => (!track || p.tracks.includes(track)) && (!need || p.matches.some((m) => m.category === need)))
  captureServerEvent(ctx.userId, 'people_crm_viewed', { institutionId: ctx.institution.id, track, need, searched: !!q, shown: shown.length })
  return (
    <div className="space-y-4">
      <HiddenMembersNote ctx={ctx} />
      <PeopleView orgName={ctx.institution.name} slug={slug} base={base} readOnly={ctx.readOnly} people={people} shown={shown} companies={companies} track={track} need={need} q={q} />
    </div>
  )
}

// The page itself, from rows already loaded (also rendered with sample rows for screenshots).
export function PeopleView({
  orgName,
  slug,
  base,
  readOnly,
  people,
  shown,
  companies,
  track,
  need,
  q,
}: {
  orgName: string
  slug: string
  base: string
  readOnly: boolean
  people: CrmPerson[]
  shown: CrmPerson[]
  companies: { id: string; name: string }[]
  track: TrackKey | null
  need: NeedKey | null
  q: string | undefined
}) {

  const href = (t: TrackKey | null) => {
    const sp = new URLSearchParams()
    if (t) sp.set('track', t)
    if (need) sp.set('need', need)
    if (q) sp.set('q', q)
    const s = sp.toString()
    return `${base}/participants${s ? `?${s}` : ''}`
  }
  const tiles = [{ key: null, label: 'Everyone', what: 'Every person the program is helping.', n: people.length }, ...TRACKS.map((t) => ({ key: t.key as TrackKey | null, label: t.label, what: t.what, n: people.filter((p) => p.tracks.includes(t.key)).length }))].filter((t) => t.key === null || t.n > 0)

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Everyone {orgName} is helping, by why they came, with the benefits each person is matched to. Open a person to see each match and why. Needs show only for people who chose to share them.
      </p>

      <nav aria-label="Tracks" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => {
          const active = t.key === track
          return (
            <Link
              key={t.label}
              href={href(t.key)}
              aria-current={active ? 'page' : undefined}
              className={cn('rounded-lg border p-3 transition-colors', active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/60')}
            >
              <span className="block text-2xl font-semibold tabular-nums">{t.n.toLocaleString()}</span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.what}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex max-w-md flex-1 gap-2" action={`${base}/participants`}>
          {track && <input type="hidden" name="track" value={track} />}
          {need && <input type="hidden" name="need" value={need} />}
          <label htmlFor="pq" className="sr-only">
            Search people
          </label>
          <input id="pq" name="q" defaultValue={q ?? ''} placeholder="Search by name or email" className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
          <button className="rounded-md border border-border px-3 text-sm">Search</button>
        </form>
        {need && (
          <p className="text-sm">
            Matched to <span className="font-medium">{needLabel(need)}</span>.{' '}
            <Link href={href(track)} className="font-medium text-primary hover:underline">
              Show all benefits
            </Link>
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Users} title={people.length === 0 ? 'No one yet' : 'No one matches'} description={people.length === 0 ? 'People join when you give a company seats and they sign up, or when you add them below.' : 'Try another track or clear the search.'} />
      ) : (
        <ul aria-label="People" className="divide-y divide-border rounded-lg border border-border bg-card">
          {shown.map((p) => (
            <li key={p.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 marker:content-none hover:bg-muted/40">
                  <span className="min-w-48 flex-1">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{[p.title, p.from, p.place].filter(Boolean).join(' · ') || p.email}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {p.tracks.map((t) => (
                      <span key={t} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', t === 'unshared' ? 'bg-muted text-muted-foreground' : 'bg-sky-50 text-sky-900')}>
                        {trackLabel(t)}
                      </span>
                    ))}
                  </span>
                  <span className="w-28 text-xs text-muted-foreground">{p.stage ? STAGE[p.stage] : p.joined ? 'Search not shared' : 'Not joined yet'}</span>
                  <span className="w-36 text-xs">
                    <span className="font-medium">
                      {p.matches.length} {p.matches.length === 1 ? 'benefit' : 'benefits'} matched
                    </span>
                    {!p.sharedNeeds && <span className="block text-muted-foreground">Needs not shared</span>}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-3 border-t border-border bg-amber-50/40 px-4 py-4">
                  {p.matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing matched yet. Matches come from a layoff, a training enrollment, and the help a person shares.</p>
                  ) : (
                    <ul className="space-y-3">
                      {p.matches.map((m) => (
                        <li key={m.name} className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[13rem_1fr]">
                          <span className="pt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{needLabel(m.category)}</span>
                          <span>
                            <span className="font-medium">{m.name}</span>
                            {m.inUse && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">In use</span>}
                            <span className="block text-muted-foreground">{m.why}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {p.sharedNeeds ? 'Includes the help they shared with you in NextChapter.' : `${p.name.split(' ')[0]} hasn't shared the help they need, so these come from their layoff and training only.`}{' '}
                    {p.email} ·{' '}
                    <Link href={`${base}/benefits`} className="font-medium text-primary hover:underline">
                      What each benefit is
                    </Link>
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {people.length === PEOPLE_TAKE && <p className="text-xs text-muted-foreground">Showing the newest {PEOPLE_TAKE}. Search to find anyone else.</p>}

      {!readOnly && (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">Add someone</summary>
          <div className="pt-3">
            <ParticipantForm slug={slug} companies={companies} />
            <p className="mt-3 text-xs text-muted-foreground">
              Adding many? Upload a spreadsheet in{' '}
              <Link href={`/i/${slug}/admin/roster`} className="font-medium text-primary hover:underline">
                Admin › Roster
              </Link>{' '}
              with affiliation PARTICIPANT, or connect your system there.
            </p>
          </div>
        </details>
      )}
    </div>
  )
}
