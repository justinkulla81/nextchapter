import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, DarkButton, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'
import { Module } from '@/components/candidate/Module'
import { cn } from '@/lib/utils'
import { CareerOneStopCredit } from '@/components/attribution/CareerOneStopCredit'

export function FindUnposted() {
  const items = [
    { c: 'Lemaitre Vascular', sig: 'Leadership change', what: 'The President retires December 31 and no successor is named.', know: 'Priya Shah (VP Operations) and 2 Ohio State alumni work there.', cta: 'Ask Priya for an intro', primary: true },
    { c: 'ManpowerGroup', sig: 'Leadership change', what: 'The President was promoted to CEO. A search for a replacement usually follows.', know: 'Marcus Lee worked there until 2023.', cta: 'Ask Marcus what he knows', primary: false },
    { c: 'Whatnot', sig: 'New funding', what: 'Raised $547M. Fresh funding usually means senior hires in the next few months.', know: 'You applied here. No one you know yet. 3 alumni work there.', cta: 'Find someone there', primary: false },
    { c: 'CSX', sig: 'Leadership change', what: 'The Chief Operating Officer retired October 12. No successor named.', know: 'No one you know yet.', cta: 'Find someone there', primary: false },
  ]
  return (
    <PreviewShell place="jobs" entry="find" part="unposted">
      <PageHeader title="Not posted yet" intro="Openings that are likely before anyone posts them. Reach the people first, and you are early." />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {items.map((i) => (
          <li key={i.c} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 flex-1 gap-4">
              <Avatar name={i.c} />
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold text-ink">{i.c} <Chip tone="warm">{i.sig}</Chip></p>
                <p className="text-base text-ink">{i.what}</p>
                <p className="text-sm text-muted-foreground"><span className="font-semibold text-ink">Who you know:</span> {i.know}</p>
                <p className="text-xs text-muted-foreground">From a public filing. <a href="#" className="underline">Read the filing</a></p>
              </div>
            </div>
            {i.primary ? <PrimaryButton>{i.cta}</PrimaryButton> : <SecondaryButton>{i.cta}</SecondaryButton>}
          </li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function FindIndependent() {
  return (
    <PreviewShell place="jobs" entry="find" part="independent">
      <PageHeader title="Independent work" intro="Consulting, fractional and advisory work, on your terms, alongside your search or instead of it." />
      <section aria-labelledby="launch" className="space-y-4 rounded-2xl bg-ink p-7 text-white">
        <h2 id="launch" className="font-display text-2xl font-semibold">Set up your own consultancy</h2>
        <p className="max-w-2xl text-base text-white/85">For most people this is the fastest route: package what you already do as an offer, and take it straight to your network.</p>
        <ol className="grid gap-2 sm:grid-cols-4">
          {[['Name your offer', true], ['Tell your network', true], ['Log your first engagement', false], ['Handle the business basics', false]].map(([t, d]) => (
            <li key={t as string} className={cn('rounded-lg p-3 text-sm', d ? 'bg-white/15' : 'bg-white/5 text-white/80')}>{d ? '✓ ' : ''}{t}</li>
          ))}
        </ol>
        <PrimaryButton>Log your first engagement</PrimaryButton>
      </section>
      <Section id="where" title="Where independent work comes from">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Fractional and talent marketplaces', 'Catalant, GigX and others match executives to projects.', '3 joined'],
            ['Expert networks', 'Paid hour-long calls with investors and consultants.', '3 joined'],
            ['Teaching and advisory', 'Guest lecturing and light advisory work keep you visible.', 'Not started'],
          ].map(([t, d, s]) => (
            <div key={t} className="flex flex-col justify-between gap-4 rounded-2xl border border-border p-5">
              <div className="space-y-1.5"><h3 className="text-base font-semibold text-ink">{t}</h3><p className="text-sm text-muted-foreground">{d}</p></div>
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-ink">{s}</span><TextLink>Open</TextLink></div>
            </div>
          ))}
        </div>
      </Section>
      <Section id="signups" title="Where you have signed up">
        <p className="text-base text-ink">8 places: Surge AI, Labelbox, Turing, Third Bridge, Mercor, micro1, AlphaSights, Business Talent Group.</p>
        <p className="text-sm text-muted-foreground">We found these in your email. Business Talent Group has accepted you. micro1 is in vetting.</p>
      </Section>
    </PreviewShell>
  )
}

export function FindResources() {
  return (
    <PreviewShell place="jobs" entry="find" part="resources">
      <PageHeader title="Resources" intro="Places to look, who can see your résumé, and short guides." />
      <Section id="boards" title="Job boards">
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {[['LinkedIn Jobs', 'The broadest reach, and recruiters check it first.'], ['Indeed', 'The largest volume of postings, in every industry.'], ['TheLadders', 'Curated for $100K+ roles.'], ['HigherEdJobs', 'University administration roles.'], ['Dice', 'Technology and engineering.'], ['Wellfound', 'Startup roles, often with equity.']].map(([t, d]) => (
            <li key={t} className="border-b border-border py-3"><a href="#" className="text-base font-semibold text-brand underline underline-offset-4">{t}</a><p className="text-sm text-muted-foreground">{d}</p></li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Jobs you apply to on these boards appear in My jobs once we see the confirmation email.</p>
      </Section>
      <Section id="book" title="Show your résumé to recruiters">
        <p className="text-base text-muted-foreground">Recruiters and hiring managers browsing by role can find your résumé.</p>
        <div className="flex gap-2" role="group" aria-label="Résumé visibility">
          <button type="button" aria-pressed className="rounded-full border border-ink bg-ink px-5 py-2 text-sm font-medium text-white">Yes, include my résumé</button>
          <button type="button" aria-pressed={false} className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink">No, keep it private</button>
        </div>
      </Section>
      <Section id="guides" title="Guides">
        <div className="grid gap-4 sm:grid-cols-2">
          {[['Getting through the gatekeeper', 'How recruiters, HR screens and hiring managers work, and how to get from inbox to interview.'], ['You have an offer. Now read it correctly.', 'Total pay, negotiation scripts, and red flags to catch.']].map(([t, d]) => (
            <a key={t} href="#" className="space-y-1.5 rounded-2xl border border-border p-5 hover:bg-muted/40"><h3 className="text-base font-semibold text-ink">{t}</h3><p className="text-sm text-muted-foreground">{d}</p><p className="text-sm font-medium text-brand">Read the guide</p></a>
          ))}
        </div>
      </Section>
      <p className="border-t border-border pt-4 text-xs text-muted-foreground">Occupation data from O*NET Web Services (USDOL/ETA); pay figures from the U.S. Bureau of Labor Statistics. <a href="#" className="underline">Full notice</a></p>
    </PreviewShell>
  )
}

export function MyJobs() {
  const tabs = [['Saved', 12], ['Applied', 24], ['Interviewing', 5], ['Offers', 0], ['Closed', 31]] as const
  const rows = [
    ['Head of Delivery', 'Harbor Health', 'Applied Monday', 'Follow up on Thursday', 'ink'],
    ['Director of Operations', 'Northwind', 'Applied last Wednesday', 'You messaged Priya Shah. Wait for her reply.', 'ink'],
    ['VP Operations (advisory)', 'Lattice Labs', 'Interview Tuesday', 'Send a thank-you today', 'warm'],
    ['COO', 'Brightline', 'Applied 2 weeks ago', 'No reply yet. Try a short follow-up.', 'muted'],
  ] as const
  return (
    <PreviewShell place="jobs" entry="mine">
      <PageHeader title="My jobs" intro="Every job you have saved or applied to, with the next step for each." action={<PrimaryButton>Add a job</PrimaryButton>} />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Stage">
        {tabs.map(([t, n], i) => (
          <button key={t} type="button" role="tab" aria-selected={i === 1} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', i === 1 ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground')}>{t} <span className="tabular-nums">{n}</span></button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(([t, c, when, next, tone]) => (
          <li key={t} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex gap-4"><Avatar name={c} /><div><p className="text-base font-semibold text-ink">{t} <span className="font-normal text-muted-foreground">· {c}</span></p><p className="text-sm text-muted-foreground">{when}</p><p className="text-sm text-ink"><span className="font-semibold">Next:</span> {next}</p></div></div>
            <div className="flex items-center gap-3"><Chip tone={tone === 'warm' ? 'warm' : 'muted'}>{tone === 'warm' ? 'Interviewing' : 'Applied'}</Chip><SecondaryButton>Open</SecondaryButton></div>
          </li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function Companies() {
  return (
    <PreviewShell place="jobs" entry="companies">
      <PageHeader title="Companies" intro="Companies you are watching, and a few worth watching." action={<PrimaryButton>Watch a company</PrimaryButton>} />
      <Section id="watching" title="Watching">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Salesforce', '5 new jobs for you', 'You know 2 people there'], ['Anthropic', '5 new jobs for you', 'No one you know yet'], ['OpenAI', '2 new jobs for you', 'You know 1 person there'], ['Deloitte', '1 new job for you', 'You know 4 people there']].map(([c, j, k]) => (
            <li key={c} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-4"><Avatar name={c} /><div><p className="text-base font-semibold text-ink">{c}</p><p className="text-sm text-muted-foreground">{j} · {k}</p></div></div><SecondaryButton>Open</SecondaryButton></li>
          ))}
        </ul>
      </Section>
      <Section id="worth" title="Worth watching">
        <div className="grid gap-4 sm:grid-cols-3">
          {[['Harbor Health', 'Hiring 4 operations leaders. Your field.'], ['Northwind', 'You applied here. 2 alumni.'], ['Lattice Labs', 'In your interview. Learn more before Thursday.']].map(([c, w]) => (
            <div key={c} className="space-y-3 rounded-2xl border border-border p-5"><div className="flex items-center gap-3"><Avatar name={c} size="sm" /><p className="text-base font-semibold text-ink">{c}</p></div><p className="text-sm text-muted-foreground">{w}</p><SecondaryButton>Watch</SecondaryButton></div>
          ))}
        </div>
      </Section>
    </PreviewShell>
  )
}

export function CompanyProfile() {
  return (
    <PreviewShell place="jobs" entry="companies">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4"><Avatar name="Northwind" size="lg" /><div className="space-y-1"><h1 className="font-display text-3xl font-semibold text-ink">Northwind</h1><p className="text-base text-muted-foreground">Logistics software · 1,200 people · Boston</p></div></div>
        <div className="flex gap-3"><SecondaryButton>Watching</SecondaryButton><PrimaryButton>Ask someone there</PrimaryButton></div>
      </header>
      <Section id="know" title="People you know here">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Priya Shah', 'VP Operations. You worked together at Meridian.'], ['Jordan Kim', 'Director of Finance. Ohio State alumnus.']].map(([n, r]) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Avatar name={n} size="sm" /><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{r}</p></div></div><SecondaryButton>Message</SecondaryButton></li>
          ))}
        </ul>
      </Section>
      <Section id="roles" title="Open roles for you">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Director of Operations', 'Strong fit · Applied', 'Applied'], ['VP Supply Chain', 'Good fit · $240–280K', ''], ['Head of Finance Operations', 'Worth a look · $200–230K', '']].map(([t, m, a]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{m}</p></div>{a ? <Chip tone="good">Applied</Chip> : <SecondaryButton>Open</SecondaryButton>}</li>
          ))}
        </ul>
      </Section>
      <Section id="say" title="What people who worked here say">
        <p className="text-base text-ink">Collaborative, fast-moving, ambitious targets. Most say the leadership is open to new ideas.</p>
        <p className="text-sm text-muted-foreground">Based on 14 members who worked here. Only shown when at least 10 have shared.</p>
      </Section>
    </PreviewShell>
  )
}

export function MarketYours() {
  return (
    <PreviewShell place="jobs" entry="market" part="market">
      <PageHeader title="Your market" intro="What the market looks like for someone with your background, this week." />
      <section aria-labelledby="grade" className="grid items-center gap-6 rounded-2xl border border-border p-7 md:grid-cols-[10rem_1fr]">
        <div className="text-center"><p className="font-display text-6xl font-semibold text-ink">B+</p><p className="text-sm text-muted-foreground">This week&apos;s market grade</p></div>
        <div className="space-y-2"><h2 id="grade" className="font-display text-2xl font-semibold text-ink">A good market for you, and improving.</h2><p className="text-base text-muted-foreground">111 jobs fit you in New York and remote. That is up 8 from last week. Pay for your level is steady.</p><TextLink>Read the full report</TextLink></div>
      </section>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[['111', 'Jobs that fit you'], ['$260–320K', 'Typical pay for your role'], ['Medium', 'How many apply, estimated']].map(([v, k]) => (
          <div key={k} className="rounded-xl bg-muted/70 p-5"><dd className="text-3xl font-semibold text-ink">{v}</dd><dt className="text-sm text-muted-foreground">{k}</dt></div>
        ))}
      </dl>
      <Section id="widen" title="Where you could widen">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Remote roles in operations', '+64 jobs'], ['One level up: Chief Operating Officer', '+23 jobs'], ['Healthcare and logistics, your skills transfer', '+41 jobs']].map(([t, n]) => (
            <li key={t} className="flex items-center justify-between gap-3 p-4"><span className="text-base text-ink">{t}</span><span className="flex items-center gap-4"><Chip tone="good">{n}</Chip><SecondaryButton>Include</SecondaryButton></span></li>
          ))}
        </ul>
      </Section>
    </PreviewShell>
  )
}

export function MarketPay() {
  return (
    <PreviewShell place="jobs" entry="market" part="pay">
      <PageHeader title="Know your worth" intro="What roles like yours pay, so you can aim well and negotiate with facts." />
      <section aria-labelledby="range" className="space-y-5 rounded-2xl border border-border p-7">
        <h2 id="range" className="font-display text-2xl font-semibold text-ink">Director of Operations, New York</h2>
        <div className="space-y-2">
          <div className="relative h-3 rounded-full bg-border" aria-hidden><div className="absolute inset-y-0 left-[15%] w-[70%] rounded-full bg-ink/25" /><div className="absolute inset-y-0 left-[45%] w-1 -translate-x-1/2 rounded bg-ink" /><div className="absolute -top-1 left-[58%] size-5 -translate-x-1/2 rounded-full border-2 border-white bg-action shadow" /></div>
          <div className="flex justify-between text-sm text-muted-foreground"><span>$190K · low</span><span>$245K · typical</span><span>$310K · high</span></div>
        </div>
        <p className="text-base text-ink"><span className="font-semibold">Your target, $265K, is above typical.</span> About 6 in 10 postings for this role pay less. Aim there, and expect to negotiate.</p>
        <p className="text-sm text-muted-foreground">Based on 412 posted salaries for this role and level in New York, last 90 days.</p>
      </section>
      <Section id="moves" title="What moves your number">
        <ul className="space-y-2 text-base text-ink">
          <li><span className="font-semibold">Company size.</span> Companies over 5,000 people pay about 12% more.</li>
          <li><span className="font-semibold">Industry.</span> Healthcare and logistics pay above the middle for your role.</li>
          <li><span className="font-semibold">Remote.</span> Remote roles pay about the same as New York ones.</li>
        </ul>
      </Section>
      <div className="flex flex-wrap items-center gap-3"><PrimaryButton>Practice a negotiation</PrimaryButton><TextLink>Change my target</TextLink></div>
    </PreviewShell>
  )
}

export function MarketLocal() {
  return (
    <PreviewShell place="jobs" entry="market" part="local">
      <PageHeader title="Local market" intro="Who is hiring near you, so you can look in person as well as online." />
      <Module title="Greater Boston">
        <p className="text-base text-ink"><span className="font-semibold">63 jobs fit you within 30 miles.</span> 41 are hybrid, 9 are on site, 13 are remote-friendly.</p>
        <ul className="divide-y divide-border">
          {[['Harbor Health', 4, 'Boston'], ['Northwind', 3, 'Cambridge'], ['State Street', 3, 'Boston'], ['Wayfair', 2, 'Boston']].map(([c, n, p]) => (
            <li key={c as string} className="flex items-center justify-between gap-3 py-3"><span className="flex items-center gap-3"><Avatar name={c as string} size="sm" /><span className="text-base font-semibold text-ink">{c}</span><span className="text-sm text-muted-foreground">{p}</span></span><span className="text-sm font-medium text-ink">{n} jobs for you</span></li>
          ))}
        </ul>
      </Module>
      <p className="text-sm text-muted-foreground">Not near Boston? <TextLink>Change your city</TextLink> or add a place you would move to.</p>
    </PreviewShell>
  )
}

export function MarketPivot() {
  const roles = [
    ['Chief of Staff', 'Closely related', '$210K', 'Growing 6%', 'Your operations and leadership background transfers directly.', 'Needs: board and investor experience.', '2 funded programs in Massachusetts'],
    ['Program Director, Healthcare', 'Related', '$185K', 'Growing 14%', 'You have run large programs and budgets.', 'Needs: healthcare regulation knowledge.', '3 funded programs in Massachusetts'],
    ['Management Consultant', 'Related', '$230K', 'Growing 10%', 'Problem solving and client work carry over.', 'Needs: a consulting case portfolio.', '1 funded program in Massachusetts'],
  ]
  return (
    <PreviewShell place="learn" entry="path" part="roles">
      <PageHeader title="Other roles you could do" intro="Roles close to yours, with what carries over, what is missing, and how to close the gap." />
      <ul className="space-y-4">
        {roles.map(([t, rel, pay, gr, has, needs, train]) => (
          <li key={t} className="space-y-3 rounded-2xl border border-border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-semibold text-ink">{t}</h2><span className="text-sm text-muted-foreground">{rel} · median {pay} · {gr}</span></div>
            <p className="text-base text-ink"><span className="font-semibold">What carries over.</span> {has}</p>
            <p className="text-base text-ink"><span className="font-semibold">What is missing.</span> {needs.replace('Needs: ', '')}</p>
            <p className="text-sm text-muted-foreground">{train}.</p>
            <div className="flex flex-wrap gap-3"><DarkButton>See 24 jobs</DarkButton><SecondaryButton>See how to close the gap</SecondaryButton></div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Job counts come from the live NextChapter job board. Long-term outlook and median wages are national BLS figures via CareerOneStop, refreshed yearly.</p>
      <CareerOneStopCredit surface="dev_preview" />
    </PreviewShell>
  )
}

export function Interviews() {
  return (
    <PreviewShell place="jobs" entry="interviews">
      <PageHeader title="Interviews" intro="Get ready for the next one, and practice the questions that decide offers." />
      <section aria-labelledby="next" className="space-y-4 rounded-2xl border border-border bg-white p-7">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Your next interview</p>
        <h2 id="next" className="font-display text-2xl font-semibold text-ink">Lattice Labs · VP Operations (advisory) · Thursday, 10:00</h2>
        <p className="text-base text-ink">Final round with the CEO. Expect questions about scaling and about how you work with a founder.</p>
        <div className="flex flex-wrap items-center gap-4"><PrimaryButton>Prepare for Thursday (15 min)</PrimaryButton><TextLink>What we know about Lattice Labs</TextLink></div>
      </section>
      <Section id="practice" title="Practice">
        <div className="grid gap-4 sm:grid-cols-3">
          {[['Tell me about yourself', 'Your story in two minutes.'], ['The hard questions', 'Gaps, why you left, salary.'], ['Closing questions', 'What to ask, and how to close.']].map(([t, d]) => (
            <a key={t} href="#" className="space-y-1.5 rounded-2xl border border-border p-5 hover:bg-muted/40"><h3 className="text-base font-semibold text-ink">{t}</h3><p className="text-sm text-muted-foreground">{d}</p></a>
          ))}
        </div>
      </Section>
      <Section id="after" title="After an interview">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Send a thank-you within a day', 'Northwind · yesterday'], ['Ask for feedback if you do not hear back in a week', 'Brightline · 6 days ago']].map(([t, w]) => (
            <li key={t} className="flex items-center justify-between gap-3 p-4"><div><p className="text-base text-ink">{t}</p><p className="text-sm text-muted-foreground">{w}</p></div><SecondaryButton>Draft it</SecondaryButton></li>
          ))}
        </ul>
      </Section>
    </PreviewShell>
  )
}

export function Offers() {
  return (
    <PreviewShell place="jobs" entry="offers">
      <PageHeader title="Offers" intro="Read it correctly, negotiate with facts, and decide with a clear head." />
      <section aria-labelledby="offer" className="space-y-5 rounded-2xl border border-border p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="offer" className="font-display text-2xl font-semibold text-ink">Lattice Labs · VP Operations (advisory)</h2><Chip tone="warm">Offer received</Chip></div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[['$255K', 'Base'], ['15%', 'Target bonus'], ['0.25%', 'Equity, 4 years']].map(([v, k]) => (
            <div key={k} className="rounded-xl bg-muted/70 p-4"><dd className="text-2xl font-semibold text-ink">{v}</dd><dt className="text-sm text-muted-foreground">{k}</dt></div>
          ))}
        </dl>
        <p className="text-base text-ink"><span className="font-semibold">Base is 4% above typical</span> for this role in New York. Equity is on the low side for this stage. That is where to ask.</p>
        <div className="flex flex-wrap items-center gap-4"><PrimaryButton>Practice the negotiation</PrimaryButton><SecondaryButton>See a script</SecondaryButton><TextLink>I accepted</TextLink></div>
      </section>
      <p className="text-sm text-muted-foreground">Not at this stage yet? Nothing to do here. We will bring you back when you have an offer.</p>
    </PreviewShell>
  )
}
