import Link from 'next/link'
import { Users } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { getMyMentorProfile, listMentorCards, listMyRequests, listRequestsForMentor } from '@/lib/higher-ed/mentors'
import { displayName } from '@/lib/higher-ed/mentor-rules'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ScreenSearchParams } from './screens'
import { MentorOptInForm, RequestActions, RequestCallForm } from './MentorForms'

type Props = { ctx: WorkspaceContext; searchParams: ScreenSearchParams; base: string }

const STATUS_LABEL: Record<string, string> = { REQUESTED: 'Waiting for a reply', ACCEPTED: 'Accepted', DECLINED: 'Declined', COMPLETED: 'Completed' }
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// Candidate workspace > Mentors. An alum can offer to take calls, browse fellow
// alumni who have, and request a call. Names show as first name and last
// initial until a call is accepted; nothing here reaches the college's staff
// views beyond engagement counts.
export async function MentorsScreen({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  if (!ctx.memberId) {
    return <p className="text-sm text-muted-foreground">This is a preview: there&apos;s no member record, so mentors aren&apos;t available.</p>
  }
  const industry = searchParams.industry ?? ''
  const fn = searchParams.fn ?? ''
  const mine = await getMyMentorProfile(ctx.memberId)
  const [cards, myRequests, incoming] = await Promise.all([
    listMentorCards({ institutionId: ctx.institution.id, viewerMemberId: ctx.memberId, industry, fn }),
    listMyRequests(ctx.memberId),
    mine ? listRequestsForMentor(mine.id) : Promise.resolve([]),
  ])

  return (
    <div className="max-w-3xl space-y-8">
      <section aria-labelledby="find-mentor" className="space-y-3">
        <h2 id="find-mentor" className="text-base font-semibold">
          Find an alum to talk to
        </h2>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" name="industry" defaultValue={industry} placeholder="For example energy" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fn">Function</Label>
            <Input id="fn" name="fn" defaultValue={fn} placeholder="For example finance" />
          </div>
          <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Search
          </button>
          {(industry || fn) && (
            <Link href="?" className="text-sm text-muted-foreground underline">
              Clear
            </Link>
          )}
        </form>
        {cards.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No mentors match yet"
            description="Alumni who offer to take calls appear here. You can be the first by offering below."
          />
        ) : (
          <ul className="space-y-3">
            {cards.map((m) => (
              <li key={m.mentorId} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-medium">{m.name}</p>
                  {m.classYear && <p className="text-xs text-muted-foreground">Class of {m.classYear}</p>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {[m.industries.join(', '), m.functions.join(', ')].filter(Boolean).join(' · ')}
                </p>
                {m.myOpenRequest ? (
                  <p className="text-sm text-foreground">You have an open request with {m.name}.</p>
                ) : m.full ? (
                  <p className="text-sm text-muted-foreground">Full this month. Check back next month.</p>
                ) : (
                  <RequestCallForm slug={slug} mentorId={m.mentorId} name={m.name} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {myRequests.length > 0 && (
        <section aria-labelledby="my-requests" className="space-y-2">
          <h2 id="my-requests" className="text-base font-semibold">
            Your requests
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {myRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {displayName(r.mentor.member.firstName, r.mentor.member.lastName)} · {dateFmt.format(r.requestedAt)} · {STATUS_LABEL[r.status]}
                </span>
                <RequestActions slug={slug} requestId={r.id} status={r.status === 'ACCEPTED' ? 'ACCEPTED' : 'NONE'} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="offer-mentor" className="space-y-3 border-t border-border pt-6">
        <h2 id="offer-mentor" className="text-base font-semibold">
          {mine?.isActive ? 'You are offering to take calls' : 'Offer to take calls'}
        </h2>
        <p className="text-sm text-muted-foreground">
          One short conversation or an introduction can change someone&apos;s search: people who come through an introduction reach
          interview far more often than cold applicants. Others see your first name and last initial, and you choose how many calls a
          month you take.
        </p>
        <MentorOptInForm
          slug={slug}
          industries={mine?.industries.join(', ') ?? ''}
          functions={mine?.functions.join(', ') ?? ''}
          maxCalls={mine?.maxCallsPerMonth ?? 2}
          active={Boolean(mine?.isActive)}
        />
      </section>

      {incoming.length > 0 && (
        <section aria-labelledby="incoming" className="space-y-2">
          <h2 id="incoming" className="text-base font-semibold">
            Requests for you
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {incoming.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {displayName(r.requester.firstName, r.requester.lastName)} · {dateFmt.format(r.requestedAt)} · {STATUS_LABEL[r.status]}
                  </span>
                  <RequestActions slug={slug} requestId={r.id} status={r.status} />
                </div>
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
