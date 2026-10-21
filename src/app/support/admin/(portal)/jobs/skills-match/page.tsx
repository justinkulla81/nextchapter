import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadSkillMatchReport, membersWithSnapshots } from '@/lib/applications/skill-snapshot-data'
import { SkillsMatchReport } from '@/components/admin/SkillsMatchReport'
import { cn } from '@/lib/utils'
import { WINDOWS, parseWindow, windowSince } from './window'

export const maxDuration = 30

export default async function AdminSkillsMatchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin()
  const win = parseWindow((await searchParams).days)

  let data: Awaited<ReturnType<typeof loadSkillMatchReport>> | null = null
  let members: { candidateId: string; applications: number; matchPct: number | null; name: string }[] = []
  let loadError = false
  try {
    const [report, top] = await Promise.all([loadSkillMatchReport(windowSince(win)), membersWithSnapshots(25)])
    data = report
    const profiles = await prisma.candidateProfile.findMany({ where: { id: { in: top.map((m) => m.candidateId) } }, select: { id: true, firstName: true, lastName: true } })
    const names = new Map(profiles.map((p) => [p.id, [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed member']))
    members = top.map((m) => ({ ...m, name: names.get(m.candidateId) ?? 'Member' }))
  } catch (err) {
    console.error('[admin/skills-match] load failed', err)
    loadError = true
  }
  captureServerEvent(admin.email ?? 'admin', 'admin_skills_match_viewed', { days: win, applications: data?.rows ?? null })

  const r = data?.report

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/support/admin/jobs" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to jobs
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Skills match and gaps in applications</h1>
        <p className="text-muted-foreground">
          What the jobs members applied to asked for, against the skills on their profile when they applied. Aggregates only; open a member from the list at the bottom.
          Inferred applications (no posting found, read from the title&apos;s O*NET occupation) count half in match.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`/support/admin/jobs/skills-match?days=${w.key}`}
            aria-current={w.key === win ? 'page' : undefined}
            className={cn('rounded-full border px-4 py-1.5 text-sm', w.key === win ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}
          >
            {w.label}
          </Link>
        ))}
        <a href={`/support/admin/jobs/skills-match/export?days=${win}`} className="ml-auto text-sm text-primary underline underline-offset-4">
          Download CSV (every segment)
        </a>
      </div>

      <SkillsMatchReport report={r ?? null} members={members} loadError={loadError} />
    </div>
  )
}
