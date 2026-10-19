import { TuneStrip } from '@/components/candidate/TuneStrip'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { NetworkOverview, type CircleData } from '@/components/network/NetworkOverview'
import { YourPeople } from '@/components/supporters/YourPeople'
import { Module } from '@/components/candidate/Module'

const CIRCLES: CircleData[] = [
  { key: 'close', name: 'Your close circle', status: 'Alex and Dana are in your corner. No coach yet.', gap: 'A coach reviews your plan and keeps you accountable week to week.', state: 'started', action: { label: 'Open your close circle', href: '#' } },
  { key: 'know', name: 'People you know', status: '184 contacts. 12 are due a follow-up.', state: 'active', action: { label: 'Review follow-ups', href: '#' } },
  { key: 'alumni', name: 'Alumni and groups', status: 'Ohio State alumni and Northwind alumni.', gap: 'Add the schools and past employers you left off to find more people.', state: 'active', action: { label: 'Find alumni at your target companies', href: '#' } },
  { key: 'industry', name: 'Industry and function', status: 'Not joined yet.', gap: 'Communities for finance and operations leaders are open to you.', state: 'empty', action: { label: 'Join a community', href: '#' } },
  { key: 'recruiters', name: 'Recruiters', status: 'Recruiters can find you once you earn Candidate+.', gap: 'You are 62% of the way there.', state: 'locked', action: { label: 'See what is left', href: '#' } },
]

export function NetworkOverviewMock() {
  return (
    <PreviewShell place="network" entry="circles" part="overview">
      <TuneStrip
        title="Warmer introductions: who you want to reach"
        pct={50}
        because="We suggest people to contact from what you tell us. Right now we only know your past employers."
        asks={[
          { ask: 'Name 3 companies you want.', gain: 'We find who you know there.' },
          { ask: 'Say how you like to reach out.', gain: 'Drafts match your style.' },
        ]}
        actionLabel="Answer two questions"
      />
      <NetworkOverview
        headline="Build it one conversation at a time. Support comes from the circles closest to you, and each step you take opens something new."
        circles={CIRCLES}
        next={{
          title: 'Ask Priya Shah for a 15-minute chat.',
          why: 'Priya is a VP of Operations at Northwind, where you applied last week. A warm introduction there counts for more than the application.',
          note: 'Hi Priya, I applied for the Director of Operations role on your team and would love 15 minutes to hear how you see it. I led a similar turnaround at my last company. Would Thursday work?',
          sendLabel: 'Send it',
        }}
        moments={[
          { key: 'intro', title: 'Your first warm introduction', payoff: 'Someone you know introduces you to a person who can hire.', progress: 'One more conversation', pct: 80 },
          { key: 'fifty', title: 'Your 50th conversation', payoff: 'A real network, built on purpose.', progress: '38 of 50', pct: 76 },
          { key: 'recruiters', title: 'Recruiters find you', payoff: 'Candidate+ puts you in front of recruiters and hiring managers.', progress: '2 of 5 steps', pct: 40 },
          { key: 'coach', title: 'A coach joins your corner', payoff: 'A plan review and weekly accountability.', progress: 'No coach yet', pct: 0 },
        ]}
      />
    </PreviewShell>
  )
}

export function CloseCircle() {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <YourPeople
        need="listen"
        inviteOpen={false}
        people={[
          { id: '1', name: 'Alex', relationship: 'partner', level: 'close', last: 'Sent a cheer yesterday' },
          { id: '2', name: 'Dana', relationship: 'friend', level: 'weekly', last: null },
        ]}
      />
      <Module title="Your coach">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <p className="text-base font-semibold text-ink">No coach yet.</p>
            <p className="text-base text-muted-foreground">A coach reviews your plan, tells you what to change, and keeps you accountable week to week. Your close circle supports you. A coach steers.</p>
          </div>
          <a href="#" className="inline-flex h-11 items-center rounded-full border border-ink px-6 text-base font-semibold text-ink hover:bg-muted">See how coaching works</a>
        </div>
      </Module>
    </PreviewShell>
  )
}
