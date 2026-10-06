import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { HELP_SCREENSHOT_BUCKET } from '@/lib/help/constants'
import { AdminHelpReplyForm, AdminHelpActions } from '@/components/admin/AdminHelpThread'

const stamp = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export default async function HelpThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const r = await prisma.helpRequest.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } })
  if (!r) notFound()
  const c = await prisma.candidateProfile.findUnique({
    where: { id: r.candidateId },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  const name = [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.email || 'Candidate'
  let screenshotUrl: string | null = null
  if (r.screenshotPath) {
    const { data } = await createAdminClient().storage.from(HELP_SCREENSHOT_BUCKET).createSignedUrl(r.screenshotPath, 60 * 30)
    screenshotUrl = data?.signedUrl ?? null
  }
  const inVision = r.kind === 'PROBLEM'
    ? await prisma.productFeedback.findFirst({ where: { candidateId: r.candidateId, channel: 'in-app problem', rawText: r.messages[0]?.body ?? '' }, select: { id: true } })
    : null

  return (
    <div className="max-w-3xl space-y-6">
      <nav className="text-sm"><Link href="/support/admin/help" className="text-muted-foreground hover:underline">← Help inbox</Link></nav>
      <header className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {r.flaggedCrisis && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">Check in: crisis language</span>}
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.kind === 'PROBLEM' ? 'bg-orange/15 text-navy' : 'bg-brand/10 text-brand'}`}>{r.kind === 'PROBLEM' ? 'Problem' : 'Help'}</span>
          <span className="text-muted-foreground">{r.status === 'RESOLVED' ? 'Resolved' : 'Open'}</span>
        </p>
        <h1 className="text-2xl font-semibold">{r.subject}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/support/admin/candidates/${r.candidateId}`} className="font-medium text-foreground underline">{name}</Link>
          {c?.email ? <> · <span className="select-all">{c.email}</span></> : null}
          {' · '}{r.contextTitle || r.contextPath || 'Help & feedback page'}
          {r.contextPath ? <> (<span className="font-mono text-xs">{r.contextPath}</span>)</> : null}
        </p>
        {r.userAgent && <p className="truncate text-xs text-muted-foreground" title={r.userAgent}>{r.userAgent}</p>}
      </header>

      {r.flaggedCrisis && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          This conversation used crisis language. The candidate was shown the 988 Suicide &amp; Crisis Lifeline when sending.
          Reply with care, and point to 988 (call or text) if it fits.
        </p>
      )}

      <ol className="space-y-3">
        {r.messages.map((m) => (
          <li key={m.id} className={`rounded-lg border p-3 text-sm ${m.fromAdmin ? 'border-brand/20 bg-brand/5' : 'border-border bg-card'}`}>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">{m.fromAdmin ? `You${m.authorEmail ? ` (${m.authorEmail})` : ''}` : name} · {stamp(m.createdAt)}</p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>

      {screenshotUrl && (
        <figure className="space-y-1">
          <figcaption className="text-sm font-medium">Screenshot</figcaption>
          <a href={screenshotUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotUrl} alt="Screenshot the candidate attached" className="max-h-96 rounded-lg border border-border" />
          </a>
        </figure>
      )}

      <AdminHelpReplyForm requestId={r.id} firstName={c?.firstName ?? null} resolved={r.status === 'RESOLVED'} />
      <AdminHelpActions requestId={r.id} resolved={r.status === 'RESOLVED'} isProblem={r.kind === 'PROBLEM'} inVision={!!inVision} />
    </div>
  )
}
