import { Check, Circle } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Module } from '@/components/candidate/Module'
import { JourneyCard } from '@/components/candidate/JourneyCard'
import { HomeNote } from '@/components/candidate/HomeNote'

const chip = 'rounded-full px-2.5 py-0.5 text-xs font-medium'

export function HomeToday() {
  return (
    <PreviewShell place="home" entry="today">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Good morning, Maya</p>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance sm:text-4xl">The right role, fast.</h1>
      </header>
      <JourneyCard
        journey="Laid off, looking"
        since="Week 3 of your search"
        facts={[{ label: 'Days active this month', value: '12' }, { label: 'Applications', value: '9' }, { label: 'Interviews', value: '1' }]}
        changes={['Your plan and weekly target follow your week in the search', 'Notes come in your coaching tone: supported']}
        tune={{ text: 'Two answers tune your week: how many hours you have, and how hard to push.', action: 'Answer two questions' }}
      />
      <HomeNote
        title="Tell 5 more people what you’re looking for."
        why="Most roles are filled through a person, not a posting, and it brings you closer to providing for your family."
        startLabel="Start"
        startHref="#"
        whyDetail="You are applying, and your plan is set up for that. Reaching out is the fastest way to turn applications into interviews. Change what your plan is set up for in Personalize."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Module title="This week’s plan">
          <ul className="divide-y divide-border text-base">
            {['Send one short message to someone who already likes you', 'Send 5 applications that fit you', 'Follow up on two open applications'].map((t) => (
              <li key={t} className="flex items-center gap-3 py-2.5">
                <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">The first step is there because you said networking is uncomfortable. <a href="#" className="font-medium text-brand underline underline-offset-4">Change what gets in the way</a></p>
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
    </PreviewShell>
  )
}

const TRAITS: [string, string, 'clear' | 'emerging' | 'none'][] = [
  ['Motivation', 'Four days a week for 11 weeks.', 'clear'],
  ['Thoroughness', 'Complete profile and 3 tailored applications.', 'emerging'],
  ['Conscientiousness', 'Logged work on 41 of the last 77 days.', 'emerging'],
  ['Communication', '38 outreach messages, 9 replies.', 'emerging'],
  ['Helpfulness', 'Answered 2 community questions.', 'emerging'],
  ['References', '2 of 3 references complete.', 'emerging'],
  ['Self-awareness', 'Work-style profile finished.', 'emerging'],
  ['Peak strengths', 'Top three chosen.', 'emerging'],
  ['Resilience', 'Not shown yet. Finish a check-in streak.', 'none'],
]

export function ProgressBuilt() {
  const weeks = [40, 55, 70, 90, 75, 110, 120, 105, 130, 140, 105]
  return (
    <PreviewShell place="home" entry="progress" part="built">
      <PageHeader title="Effort and results" intro="What you have put in, and what has come back. Effort is yours to control. Results follow, but not on a schedule." />
      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-label="Your effort" className="space-y-3 rounded-2xl border border-border p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Your effort</h2>
          <dl className="grid grid-cols-3 gap-3 text-center">{[['1,240', 'minutes in 11 weeks'], ['38', 'applications'], ['52', 'conversations']].map(([v, l]) => <div key={l} className="rounded-xl bg-muted/60 px-2 py-3"><dd className="text-2xl font-semibold text-ink tabular-nums">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>)}</dl>
        </section>
        <section aria-label="What came back" className="space-y-3 rounded-2xl border border-border p-6">
          <h2 className="font-display text-xl font-semibold text-ink">What came back</h2>
          <dl className="grid grid-cols-3 gap-3 text-center">{[['9', 'replies'], ['3', 'interviews'], ['0', 'offers yet']].map(([v, l]) => <div key={l} className="rounded-xl bg-muted/60 px-2 py-3"><dd className="text-2xl font-semibold text-ink tabular-nums">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>)}</dl>
          <p className="text-sm text-muted-foreground">Two of your three interviews came in weeks 9 and 10, your busiest weeks.</p>
        </section>
      </div>
      <p className="text-sm font-semibold text-ink">What you have built, as proof</p>

      <section aria-labelledby="plus" className="space-y-4 rounded-2xl bg-ink p-6 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="plus" className="font-display text-xl font-semibold">Candidate+ is 2 of 5 steps away from open</h2>
          <span className="text-sm text-white/70">Recruiters and hiring managers see Candidate+ members</span>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {[['480 minutes of effort', true], ['Profile complete', true], ['2 references', false], ['10 applications', false], ['Work-style profile', true]].map(([t, d]) => (
            <li key={t as string} className={`flex items-start gap-2 rounded-lg p-3 text-sm ${d ? 'bg-white/15' : 'bg-white/5'}`}>
              {d ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden />}
              <span className={d ? '' : 'text-white/80'}>{t}</span>
            </li>
          ))}
        </ol>
        <a href="#" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">Add your next reference</a>
      </section>

      <section aria-labelledby="dossier" className="space-y-3">
        <h2 id="dossier" className="font-display text-xl font-semibold text-ink">Your dossier: the nine things a résumé can’t show</h2>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {TRAITS.map(([t, e, s]) => (
            <li key={t} className="flex items-start gap-3 border-b border-border py-3">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${s === 'clear' ? 'bg-success' : s === 'emerging' ? 'bg-ink/50' : 'border border-border'}`} aria-hidden />
              <div>
                <p className="text-base font-semibold text-ink">{t} <span className="text-xs font-medium text-muted-foreground">{s === 'clear' ? 'Clear' : s === 'emerging' ? 'Emerging' : 'Not shown yet'}</span></p>
                <p className="text-sm text-muted-foreground">{e}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="effort" className="space-y-3">
        <h2 id="effort" className="font-display text-xl font-semibold text-ink">Minutes of real work, by week</h2>
        <div className="flex items-end gap-2 rounded-2xl border border-border p-4" role="img" aria-label="Minutes per week, rising from 40 to 140 over 11 weeks">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className={`w-full rounded-t ${i === weeks.length - 1 ? 'bg-ink' : 'bg-ink/30'}`} style={{ height: `${Math.round((w / 150) * 112)}px` }} />
              <span className="text-[10px] text-muted-foreground">{i + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">1 point = 1 minute. Your best week was week 10, at 140 minutes.</p>
      </section>
    </PreviewShell>
  )
}

const TIMELINE: { week: string; items: { when: string; kind: string; text: string }[] }[] = [
  {
    week: 'This week',
    items: [
      { when: 'Today', kind: 'Conversation', text: 'Messaged Priya Shah at Northwind.' },
      { when: 'Tue', kind: 'Interview', text: 'Second interview, VP Operations (advisory), Lattice Labs.' },
      { when: 'Mon', kind: 'Applied', text: 'Head of Delivery, Harbor Health.' },
    ],
  },
  {
    week: 'Last week',
    items: [
      { when: 'Fri', kind: 'Coaching', text: 'Session with your coach. Focus: closing questions.' },
      { when: 'Wed', kind: 'Applied', text: 'Director of Operations, Northwind.' },
      { when: 'Mon', kind: 'Step up', text: 'Candidate+ is 2 steps from open.' },
    ],
  },
  {
    week: '5 weeks ago',
    items: [
      { when: 'Thu', kind: 'Milestone', text: 'First interview landed.' },
      { when: 'Tue', kind: 'Plan', text: 'Your plan moved from preparing to applying.' },
    ],
  },
  { week: 'Week 1', items: [{ when: 'Day 1', kind: 'Started', text: 'You joined and set your search strategy.' }] },
]

export function ProgressTimeline() {
  return (
    <PreviewShell place="home" entry="progress" part="timeline">
      <PageHeader title="Your search so far" intro="Everything you have done, in order. Only you can see this page." />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Applications', 24], ['Interviews', 5], ['Conversations', 38], ['Minutes of work', 1420]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-muted/70 p-4">
            <dd className="text-3xl font-semibold tabular-nums text-ink">{(v as number).toLocaleString()}</dd>
            <dt className="text-sm text-muted-foreground">{k}</dt>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {['Everything', 'Applications', 'Conversations', 'Coaching'].map((f, i) => (
          <button key={f} type="button" aria-pressed={i === 0} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${i === 0 ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-8">
        {TIMELINE.map((g) => (
          <section key={g.week} aria-label={g.week} className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g.week}</h2>
            <ol className="relative space-y-4 border-l border-border pl-6">
              {g.items.map((it) => (
                <li key={it.text} className="relative">
                  <span className="absolute -left-[1.85rem] mt-1.5 size-2.5 rounded-full bg-ink" aria-hidden />
                  <p className="text-sm text-muted-foreground">{it.when} · {it.kind}</p>
                  <p className="text-base text-ink">{it.text}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </PreviewShell>
  )
}
