import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { LinkedInDraftCard } from '@/components/admin/LinkedInDraftCard'
import { LinkedInConnectionBar } from '@/components/admin/LinkedInConnectionBar'
import { getAdminLinkedIn } from '@/lib/linkedin/admin-connection'
import type { DraftFacts } from '@/lib/linkedin/layoff-post-rules'

const WHY: Record<DraftFacts['credibility'], string> = {
  'warn-filing': 'State WARN filing',
  'sec-filing': 'SEC filing',
  'two-publishers': 'Two or more publishers',
  'trusted-outlet': 'Trusted outlet',
}

// Module-level helper: Date.now() read directly in the component trips react-hooks/purity.
const nowMs = () => Date.now()

const slot = (d: Date) =>
  d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET'

export default async function LinkedInDraftsPage({ searchParams }: { searchParams: Promise<{ linkedin?: string }> }) {
  const admin = await requireAdmin()
  const { linkedin } = await searchParams
  const conn = admin.email ? await getAdminLinkedIn(admin.email) : null
  const [drafts, posted] = await Promise.all([
    prisma.linkedInPostDraft.findMany({ where: { status: 'DRAFT' }, orderBy: { scheduledFor: 'asc' } }),
    prisma.linkedInPostDraft.count({ where: { status: 'POSTED', postedAt: { gte: new Date(nowMs() - 7 * 86_400_000) } } }),
  ])
  const now = nowMs()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">LinkedIn post drafts</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          One suggested post for each credible layoff: a state WARN filing, an SEC filing, or news from two publishers or a trusted outlet,
          100 jobs or more, at most five a week. Each has a time to post, staggered through the day. Nothing posts by itself and
          nothing shows on the website. {posted} posted in the last 7 days.
        </p>
      </header>
      <LinkedInConnectionBar
        connectedAs={conn ? conn.memberName ?? 'your profile' : null}
        expiresLabel={conn ? conn.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null}
        flash={linkedin ?? null}
      />
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          No drafts waiting. A draft appears when a credible layoff of 100 jobs or more is filed.
        </p>
      ) : (
        drafts.map((d) => {
          const f = d.facts as unknown as DraftFacts
          return (
            <LinkedInDraftCard
              key={d.id}
              d={{
                id: d.id, employer: f.employer, employees: f.employees, place: f.place,
                credibilityLabel: WHY[f.credibility] ?? f.credibility, sourceUrl: f.sourceUrl, angle: d.angle,
                body: d.body, firstComment: d.firstComment, slotLabel: slot(d.scheduledFor),
                due: d.scheduledFor.getTime() <= now, rewritten: !!d.rewrittenAt, tags: f.tagSuggestions ?? [], canPost: !!conn,
              }}
            />
          )
        })
      )}
    </div>
  )
}
