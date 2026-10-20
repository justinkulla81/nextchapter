import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { PageHeader } from '@/components/candidate/PageHeader'
import { PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'

// The Market Reality Report as a one-screen brief. The long report (every section, the appendix, the
// rating rules) stays one click away as "Read the full report" and as a PDF. What the owner said: it is
// too long and too cluttered for anyone to read. So the first view is one verdict, three numbers, the
// three fixes that matter most (each with its reason and one action), and how you read in one line each.
export function MarketReportShort() {
  const numbers: [string, string][] = [
    ['Very high', 'How hard this search is'],
    ['About 28', 'Real conversations for one interview'],
    ['4 to 6 months', 'Typical time to an offer at your pace'],
  ]
  const fixes: [string, string, string][] = [
    ['Put a number beside your three biggest results', 'A hiring manager cannot size what you ran, so they assume the smaller version.', 'Fix my résumé'],
    ['Explain the move from operating roles to advisory work', 'An executive recruiter will ask. A two-line answer in your summary removes the doubt.', 'Write the answer'],
    ['Name three target companies', 'Warm introductions are how searches at your level are won, and we need names to find who you know.', 'Add companies'],
  ]
  const reads: [string, string][] = [
    ['Recruiter', 'Likely to advance'],
    ['Hiring manager', 'Advance, with reservations'],
    ['Executive recruiter', 'Likely to pause'],
  ]
  return (
    <PreviewShell place="jobs" entry="market" part="market">
      <PageHeader title="Your market reality" intro="How a recruiter, hiring manager and search firm will read you, and what to fix first." action={<PrimaryButton>Start with fix 1</PrimaryButton>} />

      <Module title="The short version">
        <p className="text-lg text-ink">You are qualified for the roles you want, and few people are. The search will be slow unless a warm introduction opens the door, so build that first and fix the résumé in parallel.</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          {numbers.map(([v, k]) => (
            <div key={k} className="rounded-xl bg-muted/70 p-4"><dd className="text-2xl font-semibold text-ink">{v}</dd><dt className="text-sm text-muted-foreground">{k}</dt></div>
          ))}
        </dl>
      </Module>

      <section aria-labelledby="fix" className="space-y-2">
        <h2 id="fix" className="font-display text-xl font-semibold text-ink">Fix these first</h2>
        <ol className="divide-y divide-border rounded-2xl border border-border">
          {fixes.map(([t, why, cta], i) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="max-w-xl"><p className="text-base font-semibold text-ink">{i + 1}. {t}</p><p className="text-sm text-muted-foreground">{why}</p></div>
              <SecondaryButton>{cta}</SecondaryButton>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="read" className="space-y-2">
        <h2 id="read" className="font-display text-xl font-semibold text-ink">How you will be read</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {reads.map(([who, verdict]) => (
            <li key={who} className="flex items-center justify-between gap-3 px-5 py-3.5"><span className="text-base font-semibold text-ink">{who}</span><span className="text-base text-ink">{verdict}</span></li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">One line each. <TextLink>See what each one asks and thinks</TextLink></p>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
        <SecondaryButton>Read the full report</SecondaryButton>
        <TextLink>Download as PDF</TextLink>
        <span className="text-sm text-muted-foreground">12 pages: experience, skills, résumé, objections, how ratings are set.</span>
      </div>
    </PreviewShell>
  )
}
