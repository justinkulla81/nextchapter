import Link from 'next/link'
import type { PortalAudience } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { HELP_AUDIENCES } from '@/lib/help/constants'
import { NPS_ANSWERED_COOLDOWN_DAYS, npsCategory, summarizeNps } from '@/lib/nps/score'

export const maxDuration = 30

const AUDIENCES: PortalAudience[] = ['CANDIDATE', 'EMPLOYER', 'COACH', 'RECRUITER']
const DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = NPS_ANSWERED_COOLDOWN_DAYS
/** Below this many answers a score moves by whole points on one reply. */
const READABLE_MIN = 30

const stamp = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
const signed = (n: number | null) => (n === null ? '—' : n > 0 ? `+${n}` : String(n))

const CATEGORY_STYLE = {
  promoter: 'bg-success/10 text-success',
  passive: 'bg-muted text-muted-foreground',
  detractor: 'bg-destructive/10 text-destructive',
} as const

/** Net Promoter Score by portal: the last 90 days against the 90 before, and the reasons people gave. */
export default async function NpsPage() {
  await requireAdmin()
  const now = new Date().getTime()
  const since = new Date(now - 2 * WINDOW_DAYS * DAY)
  const rows = await prisma.npsResponse.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, audience: true, respondentId: true, respondentLabel: true, score: true, comment: true, contextPath: true, createdAt: true },
  })
  const cut = now - WINDOW_DAYS * DAY
  const inWindow = (r: { createdAt: Date }) => r.createdAt.getTime() >= cut
  const scores = (list: typeof rows, audience?: PortalAudience) =>
    list.filter((r) => r.score !== null && (!audience || r.audience === audience)).map((r) => r.score as number)
  const current = rows.filter(inWindow)
  const previous = rows.filter((r) => !inWindow(r))

  const cards = [{ key: 'all', label: 'All portals', audience: undefined as PortalAudience | undefined }, ...AUDIENCES.map((a) => ({ key: a, label: HELP_AUDIENCES[a].label, audience: a as PortalAudience | undefined }))]
  const comments = current.filter((r) => r.score !== null && r.comment).slice(0, 60)

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Operations</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Net Promoter Score</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          “How likely are you to recommend NextChapter to a friend or colleague?” on a 0–10 scale. The score is the share of
          9–10 answers minus the share of 0–6 answers. Each person is asked after their first two weeks, then every {NPS_ANSWERED_COOLDOWN_DAYS} days
          (30 after “Not now”). Sample and demo accounts are never asked. Showing the last {WINDOW_DAYS} days against the {WINDOW_DAYS} before.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const now90 = summarizeNps(scores(current, c.audience))
          const prev90 = summarizeNps(scores(previous, c.audience))
          const dismissed = current.filter((r) => r.score === null && (!c.audience || r.audience === c.audience)).length
          const delta = now90.nps !== null && prev90.nps !== null ? now90.nps - prev90.nps : null
          return (
            <section key={c.key} aria-label={c.label} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">{c.label}</h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{signed(now90.nps)}</p>
              <p className="text-xs text-muted-foreground">
                {now90.responses} {now90.responses === 1 ? 'answer' : 'answers'}
                {delta !== null ? ` · ${signed(delta)} vs the 90 days before` : ' · no earlier period to compare'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {now90.promoters} promoters · {now90.passives} passives · {now90.detractors} detractors · {dismissed} “Not now”
              </p>
              {now90.responses > 0 && now90.responses < READABLE_MIN && (
                <p className="mt-2 text-xs text-muted-foreground">Under {READABLE_MIN} answers: one reply moves this by several points, so read the comments, not the trend.</p>
              )}
            </section>
          )
        })}
      </div>

      <section aria-labelledby="comments" className="space-y-3">
        <h2 id="comments" className="text-lg font-semibold">Reasons people gave</h2>
        {comments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No reasons yet in the last {WINDOW_DAYS} days.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {comments.map((r) => {
              const cat = npsCategory(r.score as number)
              return (
                <li key={r.id} className="space-y-1 p-4 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${CATEGORY_STYLE[cat]}`}>{r.score} · {cat}</span>
                    <span className="font-semibold">{r.respondentLabel || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground">{HELP_AUDIENCES[r.audience].label} · {stamp(r.createdAt)}{r.contextPath ? ` · ${r.contextPath}` : ''}</span>
                  </p>
                  <p className="whitespace-pre-wrap">{r.comment}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
