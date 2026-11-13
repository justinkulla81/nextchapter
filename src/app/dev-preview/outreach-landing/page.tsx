import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { NetworkHero } from '@/components/network/NetworkHero'
import { OutreachRequestBlock } from '@/components/network/OutreachRequestBlock'
import { AffectedPrompt } from '@/components/layoffs/landing/AffectedPrompt'
import { fallbackPair } from '@/lib/branding/fallback'

// The top of a company page for someone who arrived from a layoff outreach email: the HR or partner request, then the hero for the
// people leaving. Sample facts; never reachable in production.
// ?role=hr (default) or ?role=partner, ?co=<name> to see another company's colors, ?none=1 for no request block (a laid-off visitor), ?small=1 for the smaller-employer layoff page (no job counts, "Were you affected?" action).
export default async function OutreachLandingPreview({ searchParams }: { searchParams: Promise<{ role?: string; co?: string; none?: string; small?: string }> }) {
  const { role, co, none, small } = await searchParams
  const name = co || 'Acme Health'
  const partner = role === 'partner'
  return (
    <OrgBrandScope brand={fallbackPair(name.toLowerCase())}>
      <main className="min-h-screen bg-off-white py-8">
        <div className="mx-auto max-w-6xl px-6">
          {!none && (
            <OutreachRequestBlock slug="preview" employer={name} people={875} forceTags={{ role: partner ? 'partner' : 'hr', audience: partner ? 'job_center' : 'hr', arm: 'A', noticeId: 'preview' }} />
          )}
          <NetworkHero
            f={{
              employer: name,
              slug: 'preview',
              h1: `${name} laid-off workers: jobs, benefits and retraining`,
              workers: 875,
              stateLabel: 'California',
              openInState: 'about 96,000',
              openAtEmployer: 'about 40',
              latestFiled: 'Nov 4, 2026',
              places: ['Los Angeles', 'Pasadena'],
              boards: ['Los Angeles County Workforce Development Board'],
              unemploymentHref: '/unemployment-benefits/california',
              source: 'California EDD WARN filings',
              ...(small ? { openInState: null, openAtEmployer: null, workers: 66, eyebrow: `Independent page. Not from or affiliated with ${name}.` } : {}),
            }}
            capture={small ? <AffectedPrompt variant="layoff" name={name} slug="preview" /> : undefined}
          />
        </div>
      </main>
    </OrgBrandScope>
  )
}
