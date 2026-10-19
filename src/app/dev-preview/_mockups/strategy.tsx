import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { PageHeader } from '@/components/candidate/PageHeader'
import { PrimaryButton, TextLink } from '@/components/candidate/ui'

// Search strategy, simplified. Replaces a page of about twelve stacked blocks with three, in this order:
// Victoria's read, what we know (a short list you can change), and the credits toward the next strategy.
// Everything else (market size, other roles, city and industry prompts, culture preferences, the
// "while you are employed" notes) moves behind "More about your search" or into the question it belongs to.
export function SearchStrategySimple() {
  const answers: [string, string, string][] = [
    ['Target: VP Finance, fintech and health, Boston or remote', 'Decides which jobs you see and their order.', 'Change'],
    ['In the way: slow replies after the first screen', 'Shapes the advice and how we say it.', 'Change'],
    ['Networking: comfortable with warm introductions', 'Sets the outreach scripts we write.', 'Change'],
    ['Pay floor: $210,000', 'Hides roles below it.', 'Change'],
    ['Culture: small team, direct manager', 'Turns into questions to ask in interviews.', 'Change'],
  ]
  return (
    <PreviewShell place="home" entry="tailored">
      <PageHeader title="Your search strategy" intro="Victoria’s read of where you stand, and the few answers it rests on." action={<PrimaryButton>Answer 2 more questions</PrimaryButton>} />

      <Module title="Victoria’s read">
        <p className="text-base text-ink">Your record fits the roles you want, but searches like yours stall after the first screen. The fix is a warmer way in, not more applications.</p>
        <ul className="list-disc space-y-1.5 pl-5 text-base text-ink">
          <li><span className="font-semibold">Ask two former colleagues for introductions</span> at your three target companies. Warm introductions turn first screens into interviews far more often than cold applications.</li>
          <li><span className="font-semibold">Add the sizing to your top three résumé bullets.</span> Recruiters in finance read numbers first.</li>
          <li><span className="font-semibold">Widen to health-tech finance roles.</span> About 210 more open roles fit and few applicants compete for them.</li>
        </ul>
        <p className="text-sm text-muted-foreground">Based on your answers below and your activity. <TextLink>Why this read</TextLink></p>
      </Module>

      <section aria-label="What we know" className="space-y-2">
        <h2 className="font-display text-xl font-semibold text-ink">What this rests on</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {answers.map(([a, b, c]) => (
            <li key={a} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div><p className="text-base font-semibold text-ink">{a}</p><p className="text-sm text-muted-foreground">{b}</p></div>
              <TextLink>{c}</TextLink>
            </li>
          ))}
        </ul>
      </section>

      <Module title="Your next strategy" tone="dark">
        <p className="text-base">Real work earns it. A fresh read of your strategy and an updated Market Reality Report unlock together.</p>
        <div className="space-y-2"><div className="flex items-baseline justify-between text-sm"><span className="font-semibold">18 of 30 strategy credits</span><span className="text-white/80">Two introductions would finish it</span></div><div className="h-2 overflow-hidden rounded-full bg-white/20" role="meter" aria-valuenow={60} aria-valuemin={0} aria-valuemax={100} aria-label="Toward your next strategy"><div className="h-full rounded-full bg-action" style={{ width: '60%' }} /></div></div>
        <a href="#" className="text-sm font-medium text-white underline underline-offset-4">See how to earn them</a>
      </Module>

      <details className="rounded-2xl border border-border px-5 py-3.5">
        <summary className="cursor-pointer text-base font-semibold text-ink">More about your search</summary>
        <ul className="mt-3 space-y-2 text-base text-ink">
          <li><TextLink>Your market: 1,240 open roles fit, trending flat</TextLink></li>
          <li><TextLink>Other roles you could do</TextLink></li>
          <li><TextLink>Employer sectors you want jobs from</TextLink></li>
          <li><TextLink>Work you do on the side</TextLink></li>
        </ul>
      </details>
    </PreviewShell>
  )
}
