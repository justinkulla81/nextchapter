import type { Metadata } from 'next'
import Link from 'next/link'
import { PlanCard } from '@/components/marketing/PortalMarketingPage'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { FAMILY_LABELS, PORTAL_ORDER, PORTAL_PLAN_LABELS, plansAcrossPortals, plansForFamily, plansForPortal } from '@/lib/marketing/plans'
import { hubJsonLd, portalMetadata } from '@/lib/marketing/portal-seo'

// Every plan from src/lib/marketing/plans.ts: the individual plans, then each portal's plans under the portal's name with a
// link to its page, then the plan that spans the employer sections. Names and what each includes, never an amount.

const SEO = {
  title: 'Plans',
  description: 'The plans NextChapter offers for candidates, colleges, workforce organizations, employers, recruiters and coaches, and what each includes.',
  path: '/pricing',
}

export const metadata: Metadata = portalMetadata(SEO)

const PAGE = 'pricing'

export default function PlansPage() {
  const individual = plansForFamily('individual')
  const bundle = plansAcrossPortals()
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <StructuredData
        data={hubJsonLd({
          path: SEO.path,
          name: 'Plans — NextChapter',
          description: SEO.description,
          items: PORTAL_ORDER.map((p) => ({ name: PORTAL_PLAN_LABELS[p].title, path: PORTAL_PLAN_LABELS[p].href })),
          trail: [{ name: 'Plans', path: SEO.path }],
        })}
      />
      <PublicSiteHeader />

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Plans</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            NextChapter is free for candidates. Here is what each plan includes, for every kind of organization.
          </p>
        </div>

        <section className="mt-14" aria-labelledby="plans-individual">
          <h2 id="plans-individual" className="font-display text-xl font-semibold">
            {FAMILY_LABELS.individual.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{FAMILY_LABELS.individual.blurb}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {individual.map((plan) => (
              <PlanCard key={plan.planKey} plan={plan} page={PAGE} />
            ))}
          </ul>
        </section>

        {PORTAL_ORDER.map((portal) => {
          const label = PORTAL_PLAN_LABELS[portal]
          return (
            <section key={portal} className="mt-14" aria-labelledby={`plans-${portal}`}>
              <h2 id={`plans-${portal}`} className="font-display text-xl font-semibold">
                {label.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {label.blurb}{' '}
                <Link href={label.href} className="font-semibold text-brand underline underline-offset-4">
                  See the {label.title.toLowerCase()} page
                </Link>
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {plansForPortal(portal).map((plan) => (
                  <PlanCard key={plan.planKey} plan={plan} page={PAGE} portal={portal} />
                ))}
              </ul>
            </section>
          )
        })}

        {bundle.length > 0 && (
          <section className="mt-14" aria-labelledby="plans-bundle">
            <h2 id="plans-bundle" className="font-display text-xl font-semibold">
              All employer sections together
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hiring, Employees and Outplacement under one contract.{' '}
              <Link href="/employers" className="font-semibold text-brand underline underline-offset-4">
                See the employer overview
              </Link>
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {bundle.map((plan) => (
                <PlanCard key={plan.planKey} plan={plan} page={PAGE} />
              ))}
            </ul>
          </section>
        )}

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/for-organizations" className="underline underline-offset-4">
            For organizations
          </Link>
          {' · '}
          <Link href="/vs" className="underline underline-offset-4">
            Compare providers
          </Link>
          {' · '}
          <Link href="/rfp-template" className="underline underline-offset-4">
            RFP template
          </Link>
          {' · '}
          <Link href="/insights" className="underline underline-offset-4">
            Insights
          </Link>
        </div>
      </main>
    </div>
  )
}
