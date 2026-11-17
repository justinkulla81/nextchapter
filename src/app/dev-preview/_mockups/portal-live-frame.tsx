import { RecruiterNav } from '@/components/recruiter/RecruiterNav'
import { WorkspaceRail } from '@/components/higher-ed/WorkspaceRail'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import { Squiggle } from '@/components/ui/squiggle'
import { Button } from '@/components/ui/button'
import { portalStyle } from '@/lib/partners/portal-types'
import { PortalHomeHeader, PortalHomeMore, PortalLinks, PortalNeeds, PortalNumbers, PortalTable } from '@/components/partners/PortalHome'

// The live portal frame (the real nav components and the theme-portal CSS) around page markup written the way the
// existing portal pages write it: a plain text-2xl headline with its own squiggle, small capital section labels, bordered
// cards. Checks that pages not yet rebuilt pick up the portal look from the frame. Sample data only.

function OldStylePage({ name }: { name: string }) {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {name}</h1>
        <Squiggle className="mt-2" />
        <p className="mt-1 text-muted-foreground">Hartley Search (sample data)</p>
      </div>
      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Needs your attention</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <p className="font-medium text-foreground">Candidates added but not yet invited</p>
            <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">4</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <p className="font-medium text-foreground">Elena Park replied to your CFO search</p>
            <Button>Reply to Elena</Button>
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Your open searches</h2>
        <p className="mt-3 text-sm">
          Chief Financial Officer · Midway Health · <a className="text-primary underline underline-offset-4">Open the search</a>
        </p>
      </section>
    </div>
  )
}

export function PortalLiveRecruiter() {
  return (
    <div className="theme-partner theme-portal min-h-screen" style={portalStyle('recruiter')} data-shot>
      <RecruiterNav accessToken="sample" messagesUnreadCount={2} actionCount={4} talentDraftCount={0} brand={{ name: 'Hartley Search', logoUrl: null, accent: '#e07a5f' }} />
      <div className="pt-14">
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">
            <OldStylePage name="Chris" />
          </div>
        </main>
      </div>
    </div>
  )
}

export function PortalLiveWorkforce() {
  return (
    <div className="theme-partner theme-portal flex min-h-screen flex-col bg-background" style={portalStyle('workforce')} data-shot>
      <PortalTypeBar type="workforce" use="Workforce boards" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <WorkspaceRail
            items={[
              { key: 'hub', label: 'Talent Hub', icon: 'Landmark', href: '/dev-preview/portals/live/workforce', badge: null },
              { key: 'people', label: 'People', icon: 'Users', href: '/x/people', badge: null },
              { key: 'employers', label: 'Employers', icon: 'Building2', href: '/x/employers', badge: null },
              { key: 'settings', label: 'Settings', icon: 'Settings', href: '/x/settings', badge: null },
            ]}
          />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <OldStylePage name="Sam" />
        </main>
      </div>
    </div>
  )
}

// The rebuilt portal Home, from the real shared parts (src/components/partners/PortalHome.tsx) with sample data.
export function PortalLiveCoachHome() {
  return (
    <div className="theme-partner theme-portal min-h-screen" style={portalStyle('coach')} data-shot>
      <PortalTypeBar type="coach" brand={{ name: 'Maya Ortiz Coaching', logoUrl: null, accent: '#8ab17d' }} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-8">
          <PortalHomeHeader portal="coach" eyebrow="Maya Ortiz Coaching" title="Welcome back, Maya" intro="14 clients, 9 active this week." action={{ href: '#', label: 'Open your clients' }} />
          <PortalNeeds
            portal="coach"
            title="Before your next sessions"
            empty="No client needs you right now."
            items={[
              { key: 'risk_no_activity', title: 'Rob Alvarez: no search work in 9 days', why: 'His last note said he felt stuck on networking.', href: '#', action: 'Open the client' },
              { key: 'stalled', title: 'Sara Nunez has gone quiet', why: 'Week 6, grade C. Last active: 8 days ago.', href: '#', action: 'Open the client' },
              { key: 'unread_messages', title: '2 unread messages', why: 'From your clients.', href: '#', action: 'Open messages' },
            ]}
          />
          <PortalNumbers
            items={[
              { value: '14', label: 'Active clients', source: 'Linked to you on NextChapter' },
              { value: '9', label: 'Active this week', source: 'Did search work this week' },
              { value: '5', label: 'Improved their grade', source: 'This quarter, of 14 clients; 1 declined', highlight: true },
            ]}
          />
          <PortalTable
            title="Your clients"
            link={{ href: '#', label: 'See all 14' }}
            columns={['Client', 'Search week', 'Grade', 'This week', 'Last active']}
            rows={[
              { key: '1', href: '#', cells: ['Dana Whitfield', 'Week 4', 'B', '240 min of search work', 'Today'] },
              { key: '2', href: '#', cells: ['Rob Alvarez', 'Week 9', 'C', 'Quiet', '9 days ago'] },
              { key: '3', href: '#', cells: ['Kim Lee', 'Week 3', 'A', '310 min of search work', 'Yesterday'] },
            ]}
            empty="No clients yet."
          />
          <PortalHomeMore label="More for coaches">
            <PortalLinks links={[{ href: '#', label: 'Invite a client by email', line: 'They start right away.' }, { href: '#a', label: 'Settings', line: 'Branding and your onboarding form.' }]} />
          </PortalHomeMore>
        </div>
      </main>
    </div>
  )
}
