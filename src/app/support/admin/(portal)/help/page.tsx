import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { PORTAL_LABEL } from '@/lib/help/constants'

const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

const TABS = [
  { key: 'needs', label: 'Needs a reply' },
  { key: 'waiting', label: 'Waiting on them' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'ideas', label: 'Ideas & feedback' },
  { key: 'all', label: 'All' },
] as const

/** Ideas and feedback sent from Help & feedback, in the candidate portal or a partner portal. */
const IDEA_CHANNELS = ['in-app idea', 'in-app feedback', 'portal idea', 'portal feedback']

/** Candidates' help requests and problem reports. Unanswered on top. */
export default async function HelpInboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin()
  const { tab: tabRaw } = await searchParams
  const tab = TABS.some((t) => t.key === tabRaw) ? tabRaw! : 'needs'
  const where =
    tab === 'needs' ? { status: 'OPEN' as const, lastMessageFromAdmin: false }
      : tab === 'waiting' ? { status: 'OPEN' as const, lastMessageFromAdmin: true }
        : tab === 'resolved' ? { status: 'RESOLVED' as const }
          : {}
  const [rows, needsCount, ideaCount, contactCount] = await Promise.all([
    tab === 'ideas' ? Promise.resolve([]) : prisma.helpRequest.findMany({
      where,
      orderBy: [{ flaggedCrisis: 'desc' }, { lastMessageAt: 'desc' }],
      take: 200,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.helpRequest.count({ where: { status: 'OPEN', lastMessageFromAdmin: false } }),
    prisma.productFeedback.count({ where: { channel: { in: IDEA_CHANNELS }, status: 'NEW' } }),
    prisma.contactSubmission.count({ where: { handledAt: null } }),
  ])
  const ideas = tab === 'ideas'
    ? await prisma.productFeedback.findMany({
        where: { channel: { in: IDEA_CHANNELS } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, channel: true, rawText: true, status: true, contextPath: true, createdAt: true, personLabel: true,
          candidate: { select: { firstName: true, lastName: true, email: true } },
        },
      })
    : []
  const candidates = await prisma.candidateProfile.findMany({
    where: { id: { in: [...new Set(rows.flatMap((r) => (r.candidateId ? [r.candidateId] : [])))] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  const byId = new Map(candidates.map((c) => [c.id, c]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Help inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Questions and problem reports from candidates and from the employer, recruiter, coach and institution portals, sent from Help &amp; feedback. Partner replies go out by email. Ideas and feedback are on the Ideas &amp; feedback tab, and
          triaged in <Link href="/support/admin/vision/feedback" className="underline">Vision → Feedback</Link>.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filter">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/support/admin/help?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${tab === t.key ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}
          >
            {t.label}
            {t.key === 'needs' && needsCount > 0 ? ` (${needsCount})` : ''}
            {t.key === 'ideas' && ideaCount > 0 ? ` (${ideaCount} new)` : ''}
          </Link>
        ))}
        <Link href="/support/admin/crm/contact-messages" className="rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground hover:bg-muted">
          Website contact form{contactCount > 0 ? ` (${contactCount} unhandled)` : ''} →
        </Link>
      </nav>

      {tab === 'ideas' ? (
        ideas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No ideas or feedback yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {ideas.map((i) => {
              const who = i.personLabel || [i.candidate?.firstName, i.candidate?.lastName].filter(Boolean).join(' ') || i.candidate?.email || 'Someone'
              return (
                <li key={i.id}>
                  <Link href="/support/admin/vision/feedback" className="flex flex-col gap-1 p-4 hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-navy">{i.channel?.endsWith('idea') ? 'Idea' : 'Feedback'}</span>
                        {i.channel?.startsWith('portal') && <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">Partner</span>}
                        <span className="font-semibold">{who}</span>
                        {i.status === 'NEW' && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">New</span>}
                      </span>
                      <span className="mt-1 block text-sm text-foreground">{i.rawText.length > 240 ? `${i.rawText.slice(0, 239)}…` : i.rawText}</span>
                      {i.contextPath && <span className="text-xs text-muted-foreground">{i.contextPath}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(i.createdAt)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {tab === 'needs' ? 'Nothing waiting on a reply.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((r) => {
            const c = r.candidateId ? byId.get(r.candidateId) : undefined
            const isPartner = r.portal !== 'CANDIDATE'
            const name = isPartner
              ? [r.requesterName, r.requesterOrg].filter(Boolean).join(' · ') || r.requesterEmail || PORTAL_LABEL[r.portal]
              : [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.email || 'Candidate'
            return (
              <li key={r.id}>
                <Link href={`/support/admin/help/${r.id}`} className="flex flex-col gap-1 p-4 hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      {r.flaggedCrisis && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">Check in</span>}
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.kind === 'PROBLEM' ? 'bg-orange/15 text-navy' : 'bg-brand/10 text-brand'}`}>
                        {r.kind === 'PROBLEM' ? 'Problem' : 'Help'}
                      </span>
                      {isPartner && <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">{PORTAL_LABEL[r.portal] ?? r.portal}</span>}
                      <span className="font-semibold">{name}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-foreground">{r.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.contextTitle || r.contextPath || 'Help & feedback'} · {r._count.messages} {r._count.messages === 1 ? 'message' : 'messages'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(r.lastMessageAt)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
