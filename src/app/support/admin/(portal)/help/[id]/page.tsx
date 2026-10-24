import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { HELP_SCREENSHOT_BUCKET, PORTAL_LABEL } from '@/lib/help/constants'
import { AdminHelpReplyForm, AdminHelpActions } from '@/components/admin/AdminHelpThread'

const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
const dayKey = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
const dayLabel = (d: Date) => {
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  const k = dayKey(d)
  if (k === today) return 'Today'
  if (k === yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', timeZone: 'America/New_York' })
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
const span = (ms: number) => {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${Math.max(1, m)} min`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} hr`
  return `${Math.round(h / 24)} days`
}
const ago = (d: Date) => `${span(Date.now() - d.getTime())} ago`
/** How long a conversation waited for its first reply, or has been waiting so far. */
const waited = (opened: Date, firstReplyAt: Date | undefined) => (firstReplyAt ? firstReplyAt.getTime() : Date.now()) - opened.getTime()

export default async function HelpThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const r = await prisma.helpRequest.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } })
  if (!r) notFound()
  const isPartner = r.portal !== 'CANDIDATE' || !r.candidateId
  const c = r.candidateId
    ? await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { id: true, firstName: true, lastName: true, email: true } })
    : null
  const name = isPartner
    ? r.requesterName || r.requesterEmail || 'Partner user'
    : [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.email || 'Candidate'
  const email = isPartner ? r.requesterEmail : c?.email
  const portalLabel = PORTAL_LABEL[r.portal] ?? r.portal

  let screenshotUrl: string | null = null
  if (r.screenshotPath) {
    const { data } = await createAdminClient().storage.from(HELP_SCREENSHOT_BUCKET).createSignedUrl(r.screenshotPath, 60 * 30)
    screenshotUrl = data?.signedUrl ?? null
  }
  const inVision = r.kind === 'PROBLEM' && r.candidateId
    ? await prisma.productFeedback.findFirst({ where: { candidateId: r.candidateId, channel: 'in-app problem', rawText: r.messages[0]?.body ?? '' }, select: { id: true } })
    : null

  // Everything else this person has sent, so a repeat problem is obvious.
  const others = await prisma.helpRequest.findMany({
    where: {
      id: { not: r.id },
      ...(r.candidateId ? { candidateId: r.candidateId } : r.requesterEmail ? { requesterEmail: r.requesterEmail } : { id: '__none__' }),
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, subject: true, status: true, createdAt: true },
  })

  const firstReply = r.messages.find((m) => m.fromAdmin)
  const waitedMs = waited(r.createdAt, firstReply?.createdAt)
  const resolved = r.status === 'RESOLVED'
  const waitingOnUs = !resolved && !r.lastMessageFromAdmin

  // Messages grouped under day dividers, with a gap marker when more than an hour passed.
  const items: React.ReactNode[] = []
  let prevDay = ''
  r.messages.forEach((m, i) => {
    const k = dayKey(m.createdAt)
    if (k !== prevDay) {
      items.push(
        <li key={`d-${m.id}`} className="flex items-center gap-3 py-1 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />{dayLabel(m.createdAt)}<span className="h-px flex-1 bg-border" />
        </li>,
      )
      prevDay = k
    } else if (i > 0) {
      const gap = m.createdAt.getTime() - r.messages[i - 1].createdAt.getTime()
      if (gap > 3600000) items.push(<li key={`g-${m.id}`} className="text-center text-xs text-muted-foreground">{span(gap)} later</li>)
    }
    const team = m.fromAdmin
    const who = team ? 'You' : name
    items.push(
      <li key={m.id} className={`flex gap-3 ${team ? 'flex-row-reverse' : ''}`}>
        <span aria-hidden className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${team ? 'bg-navy text-white' : 'bg-muted text-foreground'}`}>
          {team ? 'NC' : initials(name)}
        </span>
        <div className={`max-w-[85%] ${team ? 'items-end text-right' : ''}`}>
          <p className="mb-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{who}</span>{team && m.authorEmail ? ` (${m.authorEmail})` : ''} · {time(m.createdAt)}
          </p>
          <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${team ? 'rounded-tr-sm bg-brand/10 text-foreground' : 'rounded-tl-sm border border-border bg-card'}`}>
            {m.body}
          </div>
        </div>
      </li>,
    )
  })

  return (
    <div className="space-y-5">
      <nav className="text-sm"><Link href="/support/admin/help" className="text-muted-foreground hover:underline">← Help inbox</Link></nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {r.flaggedCrisis && <span className="rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">Check in: crisis language</span>}
          <span className={`rounded px-2 py-0.5 font-medium ${r.kind === 'PROBLEM' ? 'bg-orange/15 text-navy' : 'bg-brand/10 text-brand'}`}>{r.kind === 'PROBLEM' ? 'Problem' : 'Help'}</span>
          <span className="rounded bg-navy/10 px-2 py-0.5 font-medium text-navy">{portalLabel}</span>
          <span className={`rounded px-2 py-0.5 font-medium ${resolved ? 'bg-success/10 text-success' : waitingOnUs ? 'bg-orange/20 text-navy' : 'bg-muted text-muted-foreground'}`}>
            {resolved ? 'Resolved' : waitingOnUs ? 'Needs your reply' : 'Waiting on them'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold">{r.subject}</h1>
      </header>

      {r.flaggedCrisis && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          This conversation used crisis language, and the person was shown the 988 Suicide &amp; Crisis Lifeline when sending.
          Reply with care, and point to 988 (call or text) if it fits.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Conversation" className="min-w-0 space-y-5">
          <ol className="space-y-4">{items}</ol>

          {screenshotUrl && (
            <figure className="space-y-1">
              <figcaption className="text-sm font-medium">Screenshot attached</figcaption>
              <a href={screenshotUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotUrl} alt="Screenshot the sender attached" className="max-h-96 rounded-lg border border-border" />
              </a>
            </figure>
          )}

          <AdminHelpReplyForm
            requestId={r.id}
            firstName={name.split(' ')[0] ?? null}
            sendTo={email ?? null}
            inApp={!isPartner}
            resolved={resolved}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">{initials(name)}</span>
              <div className="min-w-0">
                {!isPartner && r.candidateId
                  ? <Link href={`/support/admin/candidates/${r.candidateId}`} className="block truncate font-semibold underline">{name}</Link>
                  : <p className="truncate font-semibold">{name}</p>}
                <p className="truncate text-xs text-muted-foreground">{isPartner ? [portalLabel, r.requesterOrg].filter(Boolean).join(' · ') : 'Candidate'}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              {email && (
                <div><dt className="text-muted-foreground">Email</dt><dd><a href={`mailto:${email}`} className="select-all break-all underline">{email}</a></dd></div>
              )}
              <div><dt className="text-muted-foreground">Sent from</dt><dd>{r.contextTitle || r.contextPath || 'Help & feedback page'}{r.contextPath ? <span className="block break-all font-mono text-[11px] text-muted-foreground">{r.contextPath}</span> : null}</dd></div>
              <div><dt className="text-muted-foreground">Opened</dt><dd>{ago(r.createdAt)}</dd></div>
              <div><dt className="text-muted-foreground">{firstReply ? 'First reply took' : 'Waiting'}</dt><dd>{span(waitedMs)}</dd></div>
              <div><dt className="text-muted-foreground">Messages</dt><dd>{r.messages.length}</dd></div>
              {r.userAgent && <div><dt className="text-muted-foreground">Browser</dt><dd className="break-words">{r.userAgent}</dd></div>}
            </dl>
          </div>

          <AdminHelpActions requestId={r.id} resolved={resolved} isProblem={r.kind === 'PROBLEM' && !isPartner} inVision={!!inVision} />

          {others.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other conversations</h2>
              <ul className="space-y-2">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/support/admin/help/${o.id}`} className="block hover:underline">
                      <span className="line-clamp-1">{o.subject}</span>
                      <span className="text-xs text-muted-foreground">{o.status === 'RESOLVED' ? 'Resolved' : 'Open'} · {ago(o.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
