import { requireAdmin } from '@/lib/admin/auth'
import { CopyBox } from '@/components/admin/CopyBox'
import { loadWeeklyRoundup } from '@/lib/layoffs/weekly-roundup-server'
import { windowLabel } from '@/lib/layoffs/weekly-roundup'

export const dynamic = 'force-dynamic'

const n = (x: number) => x.toLocaleString('en-US')

export default async function LayoffRoundupPage() {
  await requireAdmin()
  const { roundup: r, drafts } = await loadWeeklyRoundup()
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Weekly layoff roundup</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {windowLabel(r)}: {n(r.filings)} state filings from {n(r.employers)} employers naming {n(r.workers)} workers. Drafts for LinkedIn, email and a
          reporter, from the tracker as it stands. Nothing is sent or posted from here, and a copy arrives by email every Monday morning.
        </p>
      </header>
      {r.held.length > 0 && (
        <section className="rounded-lg border border-border bg-white p-4 text-sm">
          <h2 className="text-base font-semibold text-navy">Left out of the drafts: check before using</h2>
          <p className="mt-1 text-muted-foreground">Press reports with fewer than two outlets. Add one to a draft only after you have confirmed it.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {r.held.map((h) => <li key={h.employer}>{h.employer}: about {n(h.workers)} ({h.reason})</li>)}
          </ul>
        </section>
      )}
      <CopyBox label="LinkedIn post" text={drafts.linkedin} kind="linkedin" />
      <CopyBox label={`Email: ${drafts.emailSubject}`} text={drafts.emailBody} kind="email" />
      {drafts.pitch ? <CopyBox label="Pitch for a reporter" text={drafts.pitch} kind="pitch" /> : <p className="text-sm text-muted-foreground">No pitch this week: no state filed anything.</p>}
    </div>
  )
}
