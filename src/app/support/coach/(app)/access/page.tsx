import { prisma } from '@/lib/prisma'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { MakeCodeForm, SchedulingUrlForm, SessionsLeftForm, TurnOffCodeButton } from '@/components/coach/CoachAccessForms'

// Coaches who bill clients themselves: make a code the client enters to get
// sessions, set sessions left per client, and share a booking link. Payment
// stays between coach and client; NextChapter only counts sessions.
export default async function CoachAccessPage() {
  const coach = await getCurrentCoach()
  const now = new Date()
  const [codes, clients, me] = await Promise.all([
    prisma.coachAccessCode.findMany({ where: { coachId: coach.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.candidateProfile.findMany({ where: { coachId: coach.id }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: 'asc' }, take: 300 }),
    prisma.coach.findUniqueOrThrow({ where: { id: coach.id }, select: { schedulingUrl: true } }),
  ])
  const grants = clients.length
    ? await prisma.accessGrant.findMany({ where: { candidateId: { in: clients.map((c) => c.id) }, feature: 'coaching', revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } })
    : []
  const leftFor = (id: string) => {
    const mine = grants.filter((g) => g.candidateId === id)
    if (!mine.length) return { left: null as number | null, via: null as string | null, ends: null as Date | null }
    if (mine.some((g) => g.sessionsTotal === null)) return { left: null, via: 'unlimited', ends: null }
    const left = mine.reduce((n, g) => n + Math.max(0, (g.sessionsTotal ?? 0) - g.sessionsUsed), 0)
    const via = mine.some((g) => g.source === 'outplacement_seat') ? 'their employer' : mine.some((g) => g.source === 'coach_code') ? 'a code' : 'you'
    const ends = mine.map((g) => g.endsAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null
    return { left, via, ends }
  }
  // Only the sessions this coach gives are edited here.
  const ownLeft = (id: string) => {
    const g = grants.find((x) => x.candidateId === id && x.source === 'coach' && x.coachId === coach.id)
    return g && g.sessionsTotal !== null ? Math.max(0, g.sessionsTotal - g.sessionsUsed) : null
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Codes and sessions</h1>
        <p className="mt-1 text-muted-foreground">
          Bill your clients however you like. Give them a code for the sessions they bought, keep their sessions left up to date, and share your booking link.
          Each session you log counts one down.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Make an access code</h2>
        <p className="text-sm text-muted-foreground">Your client enters it on their Executive Coach page. It links them to you and gives them the sessions.</p>
        <MakeCodeForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your codes</h2>
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet. Make one above.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {codes.map((c) => {
              const off = !!c.revokedAt || c.uses >= c.maxUses || (c.expiresAt && c.expiresAt <= now)
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <code className="font-semibold tracking-wider">{c.code}</code>
                    <p className="text-xs text-muted-foreground">
                      {c.sessions} session{c.sessions === 1 ? '' : 's'}
                      {c.validDays ? `, good for ${c.validDays} days` : ''} · used {c.uses} of {c.maxUses}
                      {c.note ? ` · ${c.note}` : ''}
                    </p>
                  </div>
                  {off ? <span className="text-xs text-muted-foreground">{c.revokedAt ? 'Turned off' : 'Used up'}</span> : <TurnOffCodeButton codeId={c.id} />}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sessions left, per client</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients yet. Invite one, or give someone a code.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {clients.map((c) => {
              const s = leftFor(c.id)
              return (
                <li key={c.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client'}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.via === 'unlimited' ? 'No session limit' : s.left === null ? 'No sessions set' : `${s.left} left, from ${s.via}`}
                      {s.ends ? ` · until ${fmt.format(s.ends)}` : ''}
                    </p>
                  </div>
                  <SessionsLeftForm candidateId={c.id} left={ownLeft(c.id)} />
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Setting sessions here changes only the sessions you give. Sessions from an employer or a code stay as they are.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scheduling</h2>
        <SchedulingUrlForm current={me.schedulingUrl} />
      </section>
    </div>
  )
}
