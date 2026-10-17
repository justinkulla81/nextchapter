import { Module } from '@/components/candidate/Module'
import { HomeNote } from '@/components/candidate/HomeNote'

const chip = 'rounded-full px-2.5 py-0.5 text-xs font-medium'

export default function HomePreview() {
  return (
    <>
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Good morning, Maya</p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">The right role, fast.</h1>
      </header>

      <HomeNote
        title="Tell 5 more people what you’re looking for."
        why="Most roles are filled through a person, not a posting."
        startLabel="Start"
        startHref="#"
        whyDetail="You are applying, and your plan is set up for that. Reaching out is the fastest way to turn applications into interviews. Change what your plan is set up for in Personalize."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Module title="This week’s plan">
          <ul className="divide-y divide-border text-base">
            {['Tell 5 more people what you’re looking for', 'Send 5 applications that fit you', 'Follow up on two open applications'].map((t) => (
              <li key={t} className="flex items-center gap-3 py-2.5">
                <span className="size-5 rounded-full border-2 border-border" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">This week: 105 of 150 minutes</span>
              <span className="text-muted-foreground">1 point = 1 minute</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={105} aria-valuemin={0} aria-valuemax={150} aria-label="Minutes this week">
              <div className="h-full rounded-full bg-ink" style={{ width: '70%' }} />
            </div>
            <p className="text-sm text-muted-foreground">Applying 35 · Networking 50 · Learning 20 · 4 days this week</p>
          </div>
        </Module>

        <Module title="Jobs" action={<a href="#" className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-ink hover:bg-muted">+ Add</a>}>
          <ul className="divide-y divide-border">
            {[
              ['Director of Operations', 'Northwind · Strong fit', 'Applied', 'bg-success/10 text-success'],
              ['Head of Delivery', 'Harbor Health · Good fit, 2 gaps', 'Saved', 'bg-muted text-muted-foreground'],
              ['VP Operations (advisory)', 'Lattice Labs · Strong fit', 'Interviewing', 'bg-orange/20 text-ink'],
            ].map(([t, m, s, c]) => (
              <li key={t} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-base font-semibold">{t}</p>
                  <p className="text-sm text-muted-foreground">{m}</p>
                </div>
                <span className={`${chip} ${c}`}>{s}</span>
              </li>
            ))}
          </ul>
          <a href="#" className="text-sm font-medium text-brand underline underline-offset-4">Open Jobs</a>
        </Module>

        <Module title="Network" action={<a href="#" className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-ink hover:bg-muted">+ Add</a>}>
          <ul className="divide-y divide-border">
            {[['Priya Shah', 'VP Operations, Northwind'], ['Marcus Lee', 'Director, Harbor Health'], ['Dana Ortiz', 'Recruiter, Lattice Labs']].map(([n, r]) => (
              <li key={n} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-base font-semibold">{n}</p>
                  <p className="text-sm text-muted-foreground">{r}</p>
                </div>
                <span className={`${chip} bg-muted text-muted-foreground`}>To contact</span>
              </li>
            ))}
          </ul>
          <a href="#" className="text-sm font-medium text-brand underline underline-offset-4">Open Network</a>
        </Module>

        <Module title="Unlocks" tone="dark">
          <p className="text-base">Your dossier is building: 7 of 9 areas have evidence so far. Finish it to become Candidate+.</p>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Next: Candidate+</span>
              <span className="text-white/70">2 of 5 steps</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5" aria-hidden>
              {[1, 1, 0, 0, 0].map((on, i) => (
                <span key={i} className={`h-1.5 rounded-full ${on ? 'bg-white' : 'bg-white/25'}`} />
              ))}
            </div>
            <p className="text-sm text-white/80">You need 1 more reference and 2 more applications. Opens exclusive jobs, your recruiter dossier and recruiter visibility.</p>
          </div>
          <a href="#" className="text-sm font-medium text-white underline underline-offset-4">See what&apos;s left</a>
        </Module>
      </div>
    </>
  )
}
