import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'

export function PeopleYouKnow() {
  const people = [
    { n: 'Priya Shah', r: 'VP Operations, Northwind', why: 'You worked together at Meridian. Northwind has a role that fits you.', cta: 'Ask for an intro', primary: true },
    { n: 'Marcus Lee', r: 'Partner, Lee Search', why: 'He placed three people like you last year. You last spoke 5 months ago.', cta: 'Say hello', primary: false },
    { n: 'Jordan Kim', r: 'Director of Finance, Northwind', why: 'Ohio State alumnus. You have not talked yet.', cta: 'Send a first note', primary: false },
    { n: 'Dana Ortiz', r: 'COO, Harbor Health', why: 'A short thank-you is due after Tuesday’s call.', cta: 'Write the thank-you', primary: false },
  ]
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <PageHeader title="People you know" intro="Start here. Most jobs come through someone you already know. Each person comes with a reason to reach out today." action={<PrimaryButton>Add people</PrimaryButton>} />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {people.map((p) => (
          <li key={p.n} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 flex-1 gap-4">
              <Avatar name={p.n} />
              <div className="space-y-0.5">
                <p className="text-base font-semibold text-ink">{p.n} <span className="font-normal text-muted-foreground">· {p.r}</span></p>
                <p className="text-sm text-ink">{p.why}</p>
              </div>
            </div>
            {p.primary ? <PrimaryButton>{p.cta}</PrimaryButton> : <SecondaryButton>{p.cta}</SecondaryButton>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">142 contacts in all. Import more from LinkedIn or your email, and we find the ones who matter for your search. <TextLink>Import contacts</TextLink></p>
    </PreviewShell>
  )
}

export function AlumniGroups() {
  const groups = [
    { n: 'Ohio State University', k: 'Alumni', d: '2,840 alumni · 31 work at companies hiring for your role', jobs: 6 },
    { n: 'Meridian Group', k: 'Former employer', d: '212 former colleagues · 9 in your field', jobs: 2 },
    { n: 'Career Transition Program', k: 'Outplacement', d: 'Your cohort of 46 · next workshop Thursday', jobs: 3 },
  ]
  return (
    <PreviewShell place="network" entry="circles" part="alumni">
      <PageHeader title="Alumni and groups" intro="Schools, past employers and programs you belong to. They are warm doors: people here want to help you." action={<SecondaryButton>Join a group</SecondaryButton>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.n} className="flex flex-col justify-between gap-5 rounded-2xl border border-border p-5">
            <div className="space-y-2">
              <Chip>{g.k}</Chip>
              <h3 className="font-display text-xl font-semibold text-ink">{g.n}</h3>
              <p className="text-sm text-muted-foreground">{g.d}</p>
            </div>
            <div className="flex items-center justify-between"><span className="text-sm text-ink">{g.jobs} jobs shared</span><TextLink>Open</TextLink></div>
          </div>
        ))}
      </div>
      <Section id="who" title="Alumni you could meet">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Elena Brandt', 'COO, Whatnot · Ohio State ’04', 'Happy to talk about moving from healthcare to marketplaces.'], ['Sam Okafor', 'VP Operations, CSX · Ohio State ’99', 'Hiring a COO. Offered to share how the process works.']].map(([n, r, w]) => (
            <li key={n} className="flex items-center justify-between gap-4 p-4">
              <div className="flex gap-3"><Avatar name={n} size="sm" /><div><p className="text-base font-semibold text-ink">{n} <span className="font-normal text-muted-foreground">· {r}</span></p><p className="text-sm text-ink">{w}</p></div></div>
              <SecondaryButton>Message</SecondaryButton>
            </li>
          ))}
        </ul>
      </Section>
    </PreviewShell>
  )
}

export function IndustryFunction() {
  return (
    <PreviewShell place="network" entry="circles" part="industry">
      <PageHeader title="Industry and function" intro="Communities of people in your field. Good for learning how others got hired, and for being found." action={<SecondaryButton>Find a community</SecondaryButton>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {[['Operations leaders', 'Function', '1,240 members · 14 posts this week', 'Joined'], ['Healthcare and logistics', 'Industry', '860 members · 9 posts this week', 'Joined'], ['Chief operating officers', 'Function', '310 members · invite based', 'Ask to join']].map(([n, k, d, s]) => (
          <div key={n} className="space-y-3 rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between"><Chip>{k}</Chip><span className="text-sm font-medium text-ink">{s}</span></div>
            <h3 className="font-display text-xl font-semibold text-ink">{n}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
            <TextLink>Open</TextLink>
          </div>
        ))}
      </div>
      <Section id="latest" title="Worth reading this week">
        <p className="rounded-2xl border border-border p-5 text-base text-ink"><span className="font-semibold">“How I moved from hospital operations to logistics in 90 days.”</span> By a member like you. 38 people found it useful.</p>
      </Section>
    </PreviewShell>
  )
}

export function RecruitersCircle() {
  return (
    <PreviewShell place="network" entry="circles" part="recruiters">
      <PageHeader title="Recruiters" intro="Recruiters who place people like you. You decide whether they can see you." />
      <section className="space-y-3 rounded-2xl bg-ink p-7 text-white">
        <h2 className="font-display text-2xl font-semibold">3 recruiters asked about you this month</h2>
        <p className="max-w-xl text-base text-white/85">They saw your Candidate+ mark and the proof behind it. You can say yes to each one, or not.</p>
        <PrimaryButton>See the 3 requests</PrimaryButton>
      </section>
      <Section id="match" title="Recruiters who place your kind of role">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Lee Search', 'Operations and finance, $200K+', 'Placed 3 people like you last year'], ['Arsenault & Co', 'Chief and VP roles, healthcare', 'Has 2 open roles that fit you'], ['Talent Bridge', 'Interim and fractional executives', 'Matches independent work']].map(([n, w, d]) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="flex gap-3"><Avatar name={n} /><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{w}. {d}.</p></div></div><SecondaryButton>Introduce myself</SecondaryButton></li>
          ))}
        </ul>
      </Section>
      <p className="text-sm text-muted-foreground">In confidential mode this circle is hidden and no recruiter can see you. <TextLink>Change privacy</TextLink></p>
    </PreviewShell>
  )
}

export function NetworkThisWeek() {
  const rows = [
    { n: 'Priya Shah', t: 'Ask for an intro to Northwind', why: 'There is a role that fits you and she works there.', done: false },
    { n: 'Dana Ortiz', t: 'Send a thank-you after Tuesday’s call', why: 'Within 24 hours is best.', done: false },
    { n: 'Marcus Lee', t: 'Say hello, it has been 5 months', why: 'He places people like you.', done: false },
    { n: 'Jordan Kim', t: 'Send a first note', why: 'Ohio State alumnus at a company you applied to.', done: true },
  ]
  return (
    <PreviewShell place="network" entry="week">
      <PageHeader title="This week" intro="Four conversations. Each one has a draft you can send in a minute." />
      <p className="text-base text-ink"><span className="font-semibold">1 of 4 done.</span> People who reach out to four people a week hear back from a company about twice as often.</p>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map((r) => (
          <li key={r.n} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex gap-4"><Avatar name={r.n} /><div><p className="text-base font-semibold text-ink">{r.t}</p><p className="text-sm text-muted-foreground">{r.n}. {r.why}</p></div></div>
            {r.done ? <Chip tone="good">Sent</Chip> : <PrimaryButton>See the draft</PrimaryButton>}
          </li>
        ))}
      </ul>
      <Section id="due" title="Follow-ups due">
        <p className="text-base text-ink">Brightline has not replied in 2 weeks. A short follow-up to Alex Rivera is ready. <TextLink>Open the draft</TextLink></p>
      </Section>
    </PreviewShell>
  )
}

export function Messages() {
  return (
    <PreviewShell place="network" entry="messages">
      <PageHeader title="Messages" intro="Everything from people in your network and your groups, in one place." />
      <div className="grid gap-0 overflow-hidden rounded-2xl border border-border md:grid-cols-[18rem_1fr]">
        <ul className="divide-y divide-border border-b border-border md:border-r md:border-b-0">
          {[['Priya Shah', 'Happy to help. Send me the role.', 'Today'], ['Elena Brandt', 'Thanks for reaching out!', 'Mon'], ['Career Transition Program', 'Thursday workshop: networking', 'Sun']].map(([n, m, d], i) => (
            <li key={n} className={`flex gap-3 p-4 ${i === 0 ? 'bg-muted/60' : ''}`}><Avatar name={n} size="sm" /><div className="min-w-0"><p className="text-sm font-semibold text-ink">{n} <span className="font-normal text-muted-foreground">· {d}</span></p><p className="truncate text-sm text-muted-foreground">{m}</p></div></li>
          ))}
        </ul>
        <div className="flex flex-col justify-between gap-6 p-6">
          <div className="space-y-3">
            <p className="max-w-sm rounded-2xl bg-muted p-3 text-sm text-ink">Hi Priya, I saw Northwind is hiring a Director of Operations. Would you be open to a quick chat?</p>
            <p className="ml-auto max-w-sm rounded-2xl bg-ink p-3 text-sm text-white">Happy to help. Send me the role.</p>
          </div>
          <div className="flex gap-2"><input aria-label="Your reply" placeholder="Write a reply" className="h-11 flex-1 rounded-full border border-border px-4 text-base" /><PrimaryButton>Send</PrimaryButton></div>
        </div>
      </div>
    </PreviewShell>
  )
}
