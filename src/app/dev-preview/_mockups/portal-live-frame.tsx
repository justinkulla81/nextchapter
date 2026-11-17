import { RecruiterNav } from '@/components/recruiter/RecruiterNav'
import { WorkspaceRail } from '@/components/higher-ed/WorkspaceRail'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import { Squiggle } from '@/components/ui/squiggle'
import { Button } from '@/components/ui/button'
import { portalStyle } from '@/lib/partners/portal-types'

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
