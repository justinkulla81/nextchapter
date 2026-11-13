import { EmployerEmailCapture } from '@/components/network/EmployerEmailCapture'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { fallbackPair } from '@/lib/branding/fallback'
import { OutreachRequestBlock } from '@/components/network/OutreachRequestBlock'

// The top of a company page for someone who arrived from a layoff outreach email: the HR or partner request, then the laid-off
// person's capture (the link is forwardable). Sample employer; never reachable in production.
// ?role=hr (default) or ?role=partner, ?co=<name> to see another company's colors
export default async function OutreachLandingPreview({ searchParams }: { searchParams: Promise<{ role?: string; co?: string }> }) {
  const { role, co } = await searchParams
  const name = co || 'Acme Health'
  const partner = role === 'partner'
  return (
    <OrgBrandScope brand={fallbackPair(name.toLowerCase())}>
    <main className="min-h-screen bg-off-white py-8">
      <div className="mx-auto max-w-6xl px-6">
        <OutreachRequestBlock
          slug="preview"
          employer={name}
          people={875}
          forceTags={{ role: partner ? 'partner' : 'hr', audience: partner ? 'job_center' : 'hr', arm: 'A', noticeId: 'preview' }}
        />
        <div className="mt-4 rounded-2xl bg-[var(--org-1,#14213D)] p-6 text-[var(--org-1-ink,#ffffff)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">NextChapter · for people leaving {name}</p>
          <h1 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">Leaving {name}? Start here.</h1>
          <p className="mt-3 max-w-2xl text-base opacity-90">About 96,000 professional jobs are open in California. Put in your email and we send a plan built for a layoff: benefits and deadlines first, then jobs matched to your background.</p>
          <EmployerEmailCapture slug="preview" employer={name} />
        </div>
      </div>
    </main>
    </OrgBrandScope>
  )
}
