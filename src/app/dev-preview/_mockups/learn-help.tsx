import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, Meter, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'

export function LearnSkills() {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <PageHeader title="Skills and courses" intro="The few skills that would open the most jobs for you. Each one says how many." />
      <section className="space-y-4 rounded-2xl border border-border p-7">
        <Chip tone="warm">Biggest gap</Chip>
        <h2 className="font-display text-2xl font-semibold text-ink">Learn supply chain analytics</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> 18 of the 40 jobs that fit you ask for it, and you have not shown it yet. A short course closes that.</p>
        <p className="text-sm text-muted-foreground">Coursera · 6 hours · $49 · <span className="text-ink">Your company pays for it</span></p>
        <PrimaryButton>Start the course</PrimaryButton>
      </section>
      <Section id="more" title="Other skills worth adding">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Python for operations', '11 jobs', '8 hours · free'], ['Lean Six Sigma green belt', '9 jobs', '3 weeks · $400'], ['Presenting to a board', '7 jobs', '2 hours · free']].map(([n, j, d]) => (
            <li key={n} className="flex items-center justify-between gap-4 p-4"><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">Asked for in {j} that fit you · {d}</p></div><SecondaryButton>See courses</SecondaryButton></li>
          ))}
        </ul>
      </Section>
      <div className="space-y-1.5"><p className="text-sm text-muted-foreground">Skills you already show: 14 of 22. Each new skill goes on your profile and into your dossier.</p><Meter pct={64} label="Skills shown" /></div>
    </PreviewShell>
  )
}

export function LearnVideos() {
  return (
    <PreviewShell place="learn" entry="learn" part="videos">
      <PageHeader title="Videos and webinars" intro="Short, practical, and picked for where you are in your search." />
      <section className="space-y-3 rounded-2xl bg-ink p-7 text-white">
        <Chip tone="warm">Live Thursday, 12:00</Chip>
        <h2 className="font-display text-2xl font-semibold">Networking when you hate networking</h2>
        <p className="max-w-xl text-base text-white/85">Forty minutes with a recruiter who places executives. Questions welcome. Replay if you miss it.</p>
        <PrimaryButton>Save my seat</PrimaryButton>
      </section>
      <Section id="watch" title="Watch when you have 10 minutes">
        <div className="grid gap-4 sm:grid-cols-3">
          {[['Answering “why did you leave?”', '8 min'], ['Your first 30 seconds', '6 min'], ['Asking for a referral', '9 min']].map(([t, m]) => (
            <div key={t} className="space-y-2 rounded-2xl border border-border p-4"><div className="aspect-video rounded-lg bg-muted" aria-hidden /><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{m}</p></div>
          ))}
        </div>
      </Section>
    </PreviewShell>
  )
}

const field = 'h-11 w-full rounded-xl border border-border px-3.5 text-base'

export function ProfileMock() {
  return (
    <PreviewShell place="personalize" entry="profile" part="profile">
      <PageHeader title="Your profile" intro="The better we know you, the better your jobs. Each answer says what it improves." />
      <div className="space-y-2"><div className="flex justify-between text-sm"><span className="font-semibold text-ink">70% tuned</span><span className="text-muted-foreground">Next: add your tools, 150 more jobs match</span></div><Meter pct={70} label="Profile tuned" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-ink">Name<input className={field} defaultValue="Justin Kulla" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-ink">Where you live<input className={field} defaultValue="New York, NY" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-ink">Role you want<input className={field} defaultValue="Director of Operations" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-ink">Tools you use <span className="font-normal text-muted-foreground">(opens 150 more jobs)</span><input className={field} placeholder="SAP, Tableau, ..." /></label>
      </div>
      <div className="flex items-center gap-5"><PrimaryButton>Save changes</PrimaryButton><TextLink>Edit the long form, step by step</TextLink></div>
    </PreviewShell>
  )
}

export function ResumeMock() {
  return (
    <PreviewShell place="personalize" entry="profile" part="resume">
      <PageHeader title="Résumé" intro="One résumé per kind of job. We check each one against the jobs you are applying to." action={<PrimaryButton>Make a new version</PrimaryButton>} />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {[['Operations leader', 'Used for 14 applications', 'Matches 86% of what jobs ask for', true], ['Healthcare operations', 'Used for 5 applications', 'Missing: supply chain, vendor contracts', false]].map(([n, u, c, g]) => (
          <li key={n as string} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{u}</p><p className="text-sm text-ink">{c}</p></div><div className="flex items-center gap-3">{g ? <Chip tone="good">Strong</Chip> : <Chip tone="warm">Can improve</Chip>}<SecondaryButton>Open</SecondaryButton></div></li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function WhyHireMe() {
  const traits = ['Motivation', 'Thoroughness', 'Conscientiousness', 'Helpfulness', 'Communication', 'References', 'Self-awareness', 'Peak strengths', 'Track record']
  return (
    <PreviewShell place="personalize" entry="profile" part="whyhire">
      <PageHeader title="Why hire me" intro="What a résumé cannot show. Everything you do here adds proof, and employers can see it when you choose." />
      <div className="grid gap-3 sm:grid-cols-3">
        {traits.map((t, i) => (
          <div key={t} className="space-y-1 rounded-2xl border border-border p-4"><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{i < 6 ? ['Searched 14 days in a row', 'Every application tailored', 'Showed up to all 5 interviews', 'Introduced 3 people', 'Replied within a day, 12 times', '2 references ready'][i] : 'Add proof to show this'}</p></div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">6 of 9 shown. Each comes from real actions, not self-ratings.</p>
    </PreviewShell>
  )
}

export function CareerStory() {
  return (
    <PreviewShell place="personalize" entry="profile" part="career">
      <PageHeader title="Your career story" intro="Your path so far, and the doors it could open. Built from what you tell us." />
      <ol className="space-y-0 border-l-2 border-border pl-6">
        {[['2025–now', 'Between chapters', 'Searching, consulting part-time'], ['2018–2025', 'VP Operations, Meridian', 'Led 400 people, cut costs 14%'], ['2012–2018', 'Director, Harbor Health', 'Opened 6 clinics'], ['2008–2012', 'Ohio State, MBA', '']].map(([y, t, d]) => (
          <li key={t} className="relative pb-6"><span className="absolute -left-[1.95rem] top-1.5 size-3 rounded-full bg-ink" aria-hidden /><p className="text-sm text-muted-foreground">{y}</p><p className="text-base font-semibold text-ink">{t}</p>{d && <p className="text-sm text-ink">{d}</p>}</li>
        ))}
      </ol>
      <section className="space-y-2 rounded-2xl border border-border p-5"><h2 className="font-display text-xl font-semibold text-ink">Doors you could open</h2><p className="text-base text-ink">Chief operating officer · Head of delivery · Fractional COO. <TextLink>See what each would take</TextLink></p></section>
    </PreviewShell>
  )
}

export function HowIWork() {
  return (
    <PreviewShell place="personalize" entry="profile" part="work">
      <PageHeader title="How I work" intro="Short assessments that tune your matches and add proof to your dossier." />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {[['Work interests', '5 minutes', 'Done', 'Finds roles you would enjoy'], ['How I work best', '8 minutes', 'Done', 'Shows employers how you collaborate'], ['Skills inventory', '10 minutes', 'Not started', 'Opens about 40 more jobs']].map(([n, t, s, w]) => (
          <li key={n} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-base font-semibold text-ink">{n} <span className="font-normal text-muted-foreground">· {t}</span></p><p className="text-sm text-ink">{w}</p></div>{s === 'Done' ? <Chip tone="good">Done</Chip> : <PrimaryButton>Start</PrimaryButton>}</li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function MySearch() {
  return (
    <PreviewShell place="personalize" entry="search">
      <PageHeader title="My search" intro="Five short steps. You can come back and change any of them." />
      <div className="space-y-2"><p className="text-sm font-semibold text-ink">Step 2 of 5: What you want</p><Meter pct={40} label="Step 2 of 5" /></div>
      <fieldset className="space-y-3"><legend className="text-base font-semibold text-ink">How much do you want to work?</legend><div className="flex flex-wrap gap-2" role="group">{['Full time', 'Part time', 'Contract', 'Either'].map((o, i) => <button key={o} type="button" aria-pressed={i === 0} className={`h-11 rounded-full border px-5 text-base ${i === 0 ? 'border-ink bg-ink text-white' : 'border-border text-ink'}`}>{o}</button>)}</div></fieldset>
      <fieldset className="space-y-3"><legend className="text-base font-semibold text-ink">Open to relocating? <span className="font-normal text-muted-foreground">(changes which cities we search)</span></legend><div className="flex flex-wrap gap-2" role="group">{['No', 'Within the region', 'Anywhere'].map((o, i) => <button key={o} type="button" aria-pressed={i === 1} className={`h-11 rounded-full border px-5 text-base ${i === 1 ? 'border-ink bg-ink text-white' : 'border-border text-ink'}`}>{o}</button>)}</div></fieldset>
      <div className="flex items-center gap-4"><PrimaryButton>Continue</PrimaryButton><SecondaryButton>Back</SecondaryButton></div>
    </PreviewShell>
  )
}

export function WhatRecruitersSee() {
  return (
    <PreviewShell place="personalize" entry="recruiters">
      <PageHeader title="What recruiters see" intro="Exactly what a recruiter sees about you, and you control it." />
      <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
        <section className="space-y-3 rounded-2xl border border-border p-6"><div className="flex items-center gap-2"><Chip tone="ink">Candidate+</Chip><span className="text-sm text-muted-foreground">Earned by 480 minutes of real work</span></div><h2 className="font-display text-2xl font-semibold text-ink">Justin K., Director of Operations</h2><p className="text-base text-ink">New York · open to full-time · healthcare and logistics. 6 of 9 traits shown, each with proof.</p></section>
        <aside className="space-y-3 rounded-2xl bg-muted/60 p-5"><p className="text-base font-semibold text-ink">Who can see this</p>{['Recruiters who place my kind of role', 'Hiring managers I apply to', 'Nobody (confidential mode)'].map((o, i) => <label key={o} className="flex items-center gap-2 text-sm text-ink"><input type="radio" name="vis" defaultChecked={i === 0} />{o}</label>)}</aside>
      </div>
    </PreviewShell>
  )
}

export function DocumentsMock() {
  return (
    <PreviewShell place="personalize" entry="documents">
      <PageHeader title="Documents" intro="Files you share with your coach or employers. Only the people you choose can open them." action={<PrimaryButton>Upload a document</PrimaryButton>} />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {[['Résumé, Operations leader.pdf', 'Shared with: your coach', 'Updated Monday'], ['Reference letter, Meridian.pdf', 'Shared with: nobody yet', 'Added last week'], ['Requested by Sara: 2024 tax summary', 'Waiting for you', 'Asked 2 days ago']].map(([n, s, d]) => (
          <li key={n} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{s} · {d}</p></div><SecondaryButton>Open</SecondaryButton></li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function MembershipMock() {
  return (
    <PreviewShell place="personalize" entry="membership">
      <PageHeader title="Membership" intro="What you have, what it includes, and what more would add." />
      <section className="space-y-3 rounded-2xl border border-border p-6"><Chip tone="good">Your plan</Chip><h2 className="font-display text-2xl font-semibold text-ink">Free, plus Candidate+ from your effort</h2><p className="text-base text-ink">1 point = 1 minute of real search work. At 480 minutes you earn Candidate+. You are at 312. <span className="font-semibold">168 to go, about 3 days.</span></p><Meter pct={65} label="Toward Candidate+" /></section>
      <Section id="more" title="Add more">
        <div className="grid gap-4 sm:grid-cols-2">{[['Premium', 'Coaching sessions, recruiter requests, résumé studio.', 'Compare plans'], ['Coach sessions', 'Book one-on-one time with a certified coach.', 'See coaches']].map(([n, d, c]) => <div key={n} className="space-y-2 rounded-2xl border border-border p-5"><h3 className="text-base font-semibold text-ink">{n}</h3><p className="text-sm text-muted-foreground">{d}</p><TextLink>{c}</TextLink></div>)}</div>
      </Section>
    </PreviewShell>
  )
}

export function HelpTalk() {
  return (
    <PreviewShell place="help" entry="talk">
      <PageHeader title="Talk to someone" intro="A hard week is normal. You do not have to carry it alone." />
      <section className="space-y-3 rounded-2xl border border-border p-7"><h2 className="font-display text-2xl font-semibold text-ink">Feeling stuck or low?</h2><p className="max-w-xl text-base text-ink">Free, private, and open any time. A person, not a bot.</p><div className="flex flex-wrap gap-3"><PrimaryButton>Talk to a counselor</PrimaryButton><SecondaryButton>Book my coach</SecondaryButton></div><p className="text-sm text-muted-foreground">In crisis? Call or text 988 any time, free.</p></section>
    </PreviewShell>
  )
}

export function HelpMoney() {
  return (
    <PreviewShell place="help" entry="money">
      <PageHeader title="Money and benefits" intro="Help bridging the gap while you search." />
      <div className="grid gap-4 sm:grid-cols-3">{[['Unemployment benefits', 'You may qualify in New York. Takes 10 minutes.', 'Check eligibility'], ['Health coverage', 'Options when your plan ends, with costs.', 'Compare options'], ['Your runway', 'About 7 months at your current spending.', 'Open the calculator']].map(([t, d, c]) => <div key={t} className="flex flex-col justify-between gap-4 rounded-2xl border border-border p-5"><div className="space-y-1.5"><h3 className="text-base font-semibold text-ink">{t}</h3><p className="text-sm text-muted-foreground">{d}</p></div><TextLink>{c}</TextLink></div>)}</div>
    </PreviewShell>
  )
}

export function HelpScams() {
  return (
    <PreviewShell place="help" entry="scams">
      <PageHeader title="Scam watch" intro="Fake jobs target people who are searching. Here is how to spot them." />
      <section className="space-y-2 rounded-2xl border border-border p-6"><h2 className="font-display text-xl font-semibold text-ink">Check a message</h2><p className="text-sm text-muted-foreground">Paste an email or message. We tell you what looks wrong, and why.</p><textarea rows={4} aria-label="Message to check" className="w-full rounded-xl border border-border p-3.5 text-base" /><PrimaryButton>Check this message</PrimaryButton></section>
      <Section id="signs" title="Three signs to know">
        <ul className="list-disc space-y-1.5 pl-5 text-base text-ink"><li>They ask you to pay for equipment or training.</li><li>The interview is only by text or chat.</li><li>The pay is far above what the job normally pays.</li></ul>
      </Section>
    </PreviewShell>
  )
}

export function HelpQuestions() {
  return (
    <PreviewShell place="help" entry="questions">
      <PageHeader title="Questions and feedback" intro="Ask us anything, or tell us what would make this better." />
      <Section id="faq" title="Most asked">
        <ul className="divide-y divide-border rounded-2xl border border-border">{['What is Candidate+?', 'Who can see my profile?', 'How do I pause my search?'].map((q) => <li key={q}><details className="p-4"><summary className="cursor-pointer text-base font-semibold text-ink">{q}</summary><p className="mt-2 text-sm text-muted-foreground">A short, plain answer appears here.</p></details></li>)}</ul>
      </Section>
      <section className="space-y-2"><label htmlFor="fb" className="text-base font-semibold text-ink">Your message</label><textarea id="fb" rows={4} className="w-full rounded-xl border border-border p-3.5 text-base" /><PrimaryButton>Send message</PrimaryButton></section>
    </PreviewShell>
  )
}
