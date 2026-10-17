import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { HomeNote } from '@/components/candidate/HomeNote'
import { JourneyCard } from '@/components/candidate/JourneyCard'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'

function Greeting({ name, line }: { name: string; line: string }) {
  return (
    <header className="space-y-1.5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Good morning, {name}</p>
      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink text-balance">{line}</h1>
    </header>
  )
}

function Plan({ items }: { items: string[] }) {
  return (
    <Module title="This week">
      <ul className="divide-y divide-border text-base">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-3 py-2.5"><span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />{t}</li>
        ))}
      </ul>
    </Module>
  )
}

export function HomeEntrepreneur() {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name="Sam" line="Keep the business moving." />
      <JourneyCard
        journey="Building something of my own"
        since="Started 3 months ago · Studio Linden, design consultancy"
        facts={[{ label: 'Stage of the venture', value: 'First clients' }, { label: 'Days a week on it', value: '4' }, { label: 'Open to a job if it stalls', value: 'Yes, quietly' }]}
        changes={['No job-search targets or application counts', 'A monthly check-in, not a daily push', 'Your network is framed as customers and advisors']}
        switchLabel="I want to look for a job too"
      />
      <HomeNote title="Ask one past client for an introduction." why="Your first three clients all came from people who knew you. A warm introduction costs them five minutes." startLabel="Draft the ask" startHref="#" whyDetail="You are building a business, so your plan is about customers and advisors, not applications. Change your journey any time." />
      <Plan items={['Follow up with the two open proposals', 'Write down what is working and what is not', 'Talk to one person who has done this before']} />
    </PreviewShell>
  )
}

export function HomeTimeOff() {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name="Ana" line="Rest well. We will be here." />
      <JourneyCard
        journey="Taking time off"
        since="On family leave · back in about 4 months"
        facts={[{ label: 'Planned return', value: 'February 2' }, { label: 'Leave funded', value: 'Partly' }, { label: 'Staying in touch', value: 'One person a month' }]}
        changes={['Job tools are paused, not locked. Nothing to catch up on.', 'One gentle idea a week, and none you must do', 'A warm-up plan starts 6 weeks before you return']}
        switchLabel="I am ready to start looking"
      />
      <HomeNote title="Say hello to one former colleague." why="Staying in touch now means you are not starting from zero when you are ready. It takes two minutes." startLabel="Pick someone" startHref="#" whyDetail="You are on leave, so your plan is light on purpose. We never count missed days." />
      <div className="rounded-2xl bg-muted/60 p-5 text-base text-ink"><span className="font-semibold">Back in 4 months.</span> We will bring back your search 6 weeks before, one small step at a time.</div>
    </PreviewShell>
  )
}

export function HomeCareerChange() {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name="Priti" line="From finance to product, one step at a time." />
      <JourneyCard
        journey="Changing careers"
        since="Week 5 · from Finance to Product management"
        facts={[{ label: 'Where you are heading', value: 'Product management' }, { label: 'Skills that carry over', value: '9 of 14' }, { label: 'Open to a step down in pay', value: 'Up to 10%' }]}
        changes={['Jobs are matched to where you are going, not where you have been', 'Skills you are missing become short courses', 'Your plan includes talking to people already in the field']}
      />
      <HomeNote title="Take the 20-minute course on user research." why="It is the one skill 11 of the 24 jobs that fit you ask for, and you have not shown it yet." startLabel="Start the course" startHref="#" whyDetail="You are changing fields, so we match jobs to the field you are heading toward and show the gaps you can close fast." />
      <Plan items={['Talk to 2 product managers about their week', 'Save 5 product roles that fit', 'Finish the user research course']} />
    </PreviewShell>
  )
}

export function HomeFractional() {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name="Lee" line="Fill the pipeline, not the inbox." />
      <JourneyCard
        journey="Fractional and independent work"
        since="Interim COO · 2 clients, 1 day a week open"
        facts={[{ label: 'Day rate', value: '$1,800' }, { label: 'Days a week open', value: '1' }, { label: 'Next renewal', value: 'Harbor Health, 3 weeks' }]}
        changes={['You see clients and engagements, not job applications', 'Renewal and referral reminders in time', 'Pay compared with other fractional day rates']}
        switchLabel="I want a full-time role instead"
      />
      <HomeNote title="Ask Harbor Health about renewing, 3 weeks early." why="Clients who are asked early renew about twice as often, and it gives you time to fill the gap if they do not." startLabel="Draft the message" startHref="#" whyDetail="You work independently, so your plan is about clients and renewals, not a job search." />
      <Plan items={['Send one referral request to a past client', 'Post one note about a result you delivered', 'Block the open day for outreach']} />
    </PreviewShell>
  )
}

export function HomeStalled() {
  return (
    <PreviewShell place="home" entry="today">
      <Greeting name="Maya" line="The right role, fast." />
      <JourneyCard
        journey="Laid off, looking"
        since="Week 4 of your search · 12 applications, 0 interviews"
        facts={[{ label: 'Days active this month', value: '17' }, { label: 'Applications', value: '12' }, { label: 'Interviews', value: '0' }]}
        changes={['Your plan changes as weeks go by', 'Today: widen the search, because the first 4 weeks gave no interviews']}
      />
      <HomeNote title="Widen your search by 150 jobs." why="Four weeks and 12 applications without an interview usually means the search is too narrow, not that you are doing anything wrong." startLabel="Show me the change" startHref="#" whyDetail="This is based on your week in the search and your results so far. Nothing changes until you tap." />
      <section className="space-y-4 rounded-2xl border border-border p-6">
        <h2 className="font-display text-xl font-semibold text-ink">What would change</h2>
        <ul className="divide-y divide-border text-base">
          {[['Roles', 'Add Head of Operations and VP Operations', '+80 jobs'], ['Places', 'Add Pittsburgh and Louisville, and remote anywhere in the US', '+50 jobs'], ['Level', 'Include roles one step below', '+20 jobs']].map(([a, b, c]) => (
            <li key={a} className="flex items-center justify-between gap-4 py-3"><span><span className="font-semibold">{a}.</span> {b}</span><Chip tone="good">{c}</Chip></li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4"><PrimaryButton>Apply these changes</PrimaryButton><SecondaryButton>Pick which ones</SecondaryButton><TextLink>Not now</TextLink></div>
        <p className="text-sm text-muted-foreground">Also an option: see other roles you could do. <TextLink>Explore other roles</TextLink></p>
      </section>
    </PreviewShell>
  )
}

function CheckInCard({ tone, title, line, options, reply }: { tone: string; title: string; line: string; options: string[]; reply: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <Chip>{tone}</Chip>
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="text-base text-ink">{line}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="How are you doing">
        {options.map((o) => <button key={o} type="button" className="h-11 rounded-full border border-border px-5 text-base text-ink hover:bg-muted">{o}</button>)}
      </div>
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-ink"><span className="font-semibold">If you pick the last one:</span> {reply}</p>
    </div>
  )
}

export function CheckIn() {
  return (
    <PreviewShell place="home" entry="today" wide>
      <PageHeader title="The check-in" intro="One question on Home, in your coaching tone. Your answer changes your plan, and it is never shown to employers or recruiters." />
      <div className="grid gap-5 lg:grid-cols-3">
        <CheckInCard tone="Pushed hard" title="Week 4. How is it going?" line="Be straight with me, and I will adjust." options={['Fired up', 'Steady', 'Running low']} reply="Your week drops to three small actions, and one is a break. We try again Monday." />
        <CheckInCard tone="Casual" title="How are you doing?" line="No wrong answer. It helps me pick today’s note." options={['Pretty good', 'Okay', 'Rough']} reply="Today’s note becomes one easy thing. The rest waits." />
        <CheckInCard tone="Supported" title="How are you feeling this week?" line="A search has hard weeks. Telling us helps us make this one lighter." options={['Hopeful', 'Up and down', 'Heavy']} reply="We lighten your plan, and offer to connect you with someone to talk to. You choose." />
      </div>
      <p className="text-sm text-muted-foreground">Asked about once a week, and only when you open Home. Skipping it is fine. Today there are two separate check-ins, a mood pop-up and a “Still searching?” dialog. They become this one.</p>
    </PreviewShell>
  )
}

export function TailoredForYou() {
  const rows: { group: string; items: [string, string, string][] }[] = [
    { group: 'Your journey and how you are doing', items: [
      ['Journey: laid off, looking. Week 4.', 'Sets your plan, your weekly target and which tools you see.', 'Change'],
      ['Tone: supported.', 'Changes how much we ask and how we say it.', 'Change'],
      ['This week: steady.', 'Lightens or raises your plan to match.', 'Check in'],
    ] },
    { group: 'Better jobs', items: [
      ['Role, place and pay: set.', 'Decides which jobs you see and their order.', 'Change'],
      ['Tools: not added.', 'Adding them opens about 150 more jobs.', 'Add'],
      ['Relocation: not answered.', 'Answering opens Pittsburgh and Louisville.', 'Answer'],
    ] },
    { group: 'Warmer introductions', items: [
      ['Target companies: none yet.', 'Naming three lets us find who you know there.', 'Add'],
      ['Recruiters can see you: yes.', 'Controls who sees your Candidate+ mark.', 'Change'],
    ] },
    { group: 'Closer to hired', items: [
      ['Skills: 14 confirmed.', 'Decides which courses we suggest.', 'Review'],
      ['Direction: same field.', 'Say if you want to explore other roles.', 'Explore'],
    ] },
    { group: 'Your proof', items: [
      ['Dossier: 7 of 9 traits shown.', 'What a résumé cannot show. Recruiters see it with Candidate+.', 'See it'],
    ] },
  ]
  return (
    <PreviewShell place="home" entry="tailored">
      <PageHeader title="Tailored for you" intro="Everything we use to shape this site around you, what each thing changes, and what would help most." action={<PrimaryButton>Add your tools (+150 jobs)</PrimaryButton>} />
      <div className="space-y-6">
        {rows.map((g) => (
          <section key={g.group} aria-label={g.group} className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-ink">{g.group}</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {g.items.map(([a, b, c]) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"><div><p className="text-base font-semibold text-ink">{a}</p><p className="text-sm text-muted-foreground">{b}</p></div><TextLink>{c}</TextLink></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Account and privacy settings are in <TextLink>Account and privacy</TextLink>.</p>
    </PreviewShell>
  )
}
