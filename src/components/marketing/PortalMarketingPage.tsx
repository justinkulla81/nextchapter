import Image from 'next/image'
import type { ReactNode } from 'react'
import { ContactForm } from '@/components/marketing/ContactForm'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ActionBand, AudienceSection, AudienceShell, Disclosure, actionButton } from '@/components/organizations/AudienceShell'
import { StructuredData } from '@/components/StructuredData'
import { PORTAL_PLAN_LABELS, plansAcrossPortals, plansForPortal, type Plan, type PortalKey } from '@/lib/marketing/plans'
import { portalJsonLd, type PortalJsonLdInput } from '@/lib/marketing/portal-seo'

// The one template for every partner page: higher education, workforce, hiring, employees, outplacement,
// recruiters, coaches, nonprofits and the employer overview. Owner brief 2026-10-24:
//   hero (one value-proposition headline, one primary action) -> proof (live data where it exists, otherwise a
//   labeled "Sample data" visual) -> three visuals -> how it works in three steps -> packages (from
//   src/lib/marketing/plans.ts, free first, never an amount) -> short FAQ -> final action.
// The candidate page contract in docs/candidate-redesign.md ("at most three sections on the first view") governs
// pages under src/app/dashboard. These are public pages: the first view is the hero alone, and every section
// below it says what it shows and why.

export interface PortalVisual {
  /** A file under public/marketing, rendered by scripts/marketing/render-screenshots.mjs from a dev-preview page. */
  src: string
  width: number
  height: number
  alt: string
  title: string
  /** One sentence: what the screen is for and why it is built the way it is. */
  why: string
}

export interface PortalStep {
  title: string
  body: string
}

export type PortalProof =
  /** Live data from our own database. `node` renders its own section. */
  | { kind: 'live'; node: ReactNode }
  /** The first visual, shown large and labeled as sample data. */
  | { kind: 'sample'; heading: string; intro: string }

export interface PortalClaim {
  title: string
  /** Plain paragraphs: how a staff member claims the organization's page. Full URLs are written out in the text. */
  paragraphs: string[]
}

export interface PortalFinalCta {
  title: string
  intro?: string
  /** A direct action (sign up, claim). Rendered as the primary button in the band. */
  action?: { label: string; href: string }
  /** A contact form that reaches us. Shown under the action, or alone when there is no direct action. */
  form?: { audience: 'ORGANIZATION' | 'COACH_RECRUITER'; source: string; heading: string }
}

export interface PortalPageContent {
  /** The analytics key for this page: it travels with every event the page fires. */
  analyticsKey: string
  path: string
  eyebrow: string
  headline: string
  subhead: string
  primary: { label: string; href: string }
  primaryNote?: string
  loginHref?: string
  parent?: { href: string; label: string }
  proof: PortalProof
  visuals: PortalVisual[]
  steps: PortalStep[]
  /** Pages whose primary action is "Claim your page": where and how the claim works. Anchor: #claim. */
  claim?: PortalClaim
  /** Whose plans the packages section shows, in order. */
  plansFor: PortalKey[]
  /** The employer overview also shows the plan that spans every employer section (the enterprise bundle). */
  includeBundle?: boolean
  plansIntro: string
  faq: { q: string; a: string }[]
  finalCta: PortalFinalCta
  footerLinks?: { href: string; label: string }[]
  jsonLd: Omit<PortalJsonLdInput, 'path' | 'planNames' | 'faq'>
}

const CARD = 'rounded-2xl border border-border bg-white p-5'

function SampleBadge() {
  return <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-ink">Sample data</span>
}

function Visual({ v, wide, priority }: { v: PortalVisual; wide?: boolean; priority?: boolean }) {
  return (
    <figure className={wide ? 'md:col-span-2' : undefined}>
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <Image
          src={v.src}
          width={v.width}
          height={v.height}
          alt={v.alt}
          sizes={wide ? '(min-width: 896px) 832px, 100vw' : '(min-width: 896px) 408px, 100vw'}
          priority={priority}
          className="h-auto w-full"
        />
      </div>
      <figcaption className="mt-3 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {v.title} <SampleBadge />
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{v.why} The people and numbers are invented.</p>
      </figcaption>
    </figure>
  )
}

function PlanCard({ plan, page, portal }: { plan: Plan; page: string; portal?: PortalKey }) {
  return (
    <li className={`${CARD} flex flex-col`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-ink">{plan.name}</p>
        {plan.free && <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Free</span>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{plan.audience}</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
        {plan.includes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {plan.addOns.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Add-ons: {plan.addOns.join('; ')}.</p>}
      <div className="mt-auto pt-4">
        <TrackedLink
          href={plan.cta.href}
          event="portal_plan_cta_clicked"
          properties={{ page, portal: portal ?? 'all_sections', planKey: plan.planKey, cta: plan.cta.label, free: !!plan.free }}
          className={plan.free ? 'inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95' : 'inline-flex h-11 items-center rounded-full border border-ink px-6 text-sm font-semibold text-ink hover:bg-muted'}
        >
          {plan.cta.label}
        </TrackedLink>
      </div>
    </li>
  )
}

export function PortalMarketingPage({ content: c }: { content: PortalPageContent }) {
  const sampleProof = c.proof.kind === 'sample'
  const [lead, ...rest] = c.visuals
  const gallery = sampleProof ? rest : c.visuals
  const plans = c.plansFor.flatMap((portal) => plansForPortal(portal).map((plan) => ({ plan, portal })))
  const bundle = c.includeBundle ? plansAcrossPortals() : []
  const planNames = [...plans.map(({ plan }) => plan.name), ...bundle.map((plan) => plan.name)]

  return (
    <>
      <StructuredData data={portalJsonLd({ ...c.jsonLd, path: c.path, planNames, faq: c.faq })} />
      <AudienceShell
        page={c.analyticsKey}
        parent={c.parent}
        eyebrow={c.eyebrow}
        headline={c.headline}
        subhead={c.subhead}
        primary={c.primary}
        primaryNote={c.primaryNote}
        loginHref={c.loginHref}
        footerLinks={[{ href: '/pricing', label: 'Plans' }, ...(c.footerLinks ?? [])]}
      >
        {c.proof.kind === 'live' ? (
          c.proof.node
        ) : (
          lead && (
            <AudienceSection id="proof" title={c.proof.heading}>
              <p className="mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground">{c.proof.intro}</p>
              <div className="grid gap-8">
                <Visual v={lead} priority />
              </div>
            </AudienceSection>
          )
        )}

        {gallery.length > 0 && (
          <AudienceSection id="screens" title={sampleProof ? 'More of the workspace' : 'Inside the workspace'}>
            <div className="grid gap-8 md:grid-cols-2">
              {gallery.map((v, i) => (
                <Visual key={v.src} v={v} wide={gallery.length % 2 === 1 && i === 0} />
              ))}
            </div>
          </AudienceSection>
        )}

        <AudienceSection id="how-it-works" title="How it works">
          <ol className="grid gap-4 md:grid-cols-3">
            {c.steps.map((s, i) => (
              <li key={s.title} className={CARD}>
                <p aria-hidden className="font-display text-3xl font-semibold text-ink/30">
                  {i + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </AudienceSection>

        {c.claim && (
          <AudienceSection id="claim" title={c.claim.title}>
            <div className="max-w-2xl space-y-3 text-base leading-relaxed text-ink">
              {c.claim.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </AudienceSection>
        )}

        <AudienceSection id="plans" title="Plans">
          <p className="mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground">{c.plansIntro}</p>
          <div className="space-y-8">
            {c.plansFor.map((portal) => {
              const own = plans.filter((p) => p.portal === portal)
              return (
                <div key={portal}>
                  {c.plansFor.length > 1 && <h3 className="mb-3 text-lg font-semibold text-ink">{PORTAL_PLAN_LABELS[portal].title}</h3>}
                  <ul className="grid gap-4 md:grid-cols-2">
                    {own.map(({ plan }) => (
                      <PlanCard key={plan.planKey} plan={plan} page={c.analyticsKey} portal={portal} />
                    ))}
                  </ul>
                </div>
              )
            })}
            {bundle.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-ink">All sections together</h3>
                <ul className="grid gap-4 md:grid-cols-2">
                  {bundle.map((plan) => (
                    <PlanCard key={plan.planKey} plan={plan} page={c.analyticsKey} />
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Every plan for every portal is on{' '}
            <TrackedLink href="/pricing" event="portal_cta_clicked" properties={{ page: c.analyticsKey, cta: 'all_plans', location: 'plans' }} className="font-semibold text-brand underline underline-offset-4">
              the plans page
            </TrackedLink>
            .
          </p>
        </AudienceSection>

        <AudienceSection id="faq" title="Questions">
          <div className="space-y-3">
            {c.faq.map((f) => (
              <Disclosure key={f.q} title={f.q}>
                <p className="text-base leading-relaxed text-muted-foreground">{f.a}</p>
              </Disclosure>
            ))}
          </div>
        </AudienceSection>

        <ActionBand id="talk" title={c.finalCta.title} intro={c.finalCta.intro}>
          <div className="space-y-6">
            {c.finalCta.action && (
              <div>
                <TrackedLink
                  href={c.finalCta.action.href}
                  event="portal_cta_clicked"
                  properties={{ page: c.analyticsKey, cta: c.finalCta.action.label, location: 'final' }}
                  className={actionButton}
                >
                  {c.finalCta.action.label}
                </TrackedLink>
              </div>
            )}
            {c.finalCta.form && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-ink">{c.finalCta.form.heading}</h3>
                <ContactForm initialAudience={c.finalCta.form.audience} source={c.finalCta.form.source} />
              </div>
            )}
          </div>
        </ActionBand>
      </AudienceShell>
    </>
  )
}
