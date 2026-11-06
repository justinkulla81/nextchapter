import type { ReactNode } from 'react'
import { Squiggle } from '@/components/ui/squiggle'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'
import { stateBrandFromSlug, statePhrase } from '@/lib/branding/state-colors'
import { stateName } from '@/lib/seo/states'
import Image from 'next/image'
import { PageCaptureTop, PageCaptureOwner } from '@/components/capture/PageCapture'
import type { JourneyAsk } from '@/components/capture/NextStepBox'
import { PullCtaTop, pullContext, withPullCtas } from '@/components/capture/PullCta'
import type { PageCaptureConfig } from '@/lib/capture/page-capture'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'

export const H2 = 'text-2xl font-bold tracking-tight text-navy'
export const LINK = 'text-brand underline underline-offset-4'

/** The frame for the programmatic public pages (workforce, higher education by state, rapid response, tools). */
export function SeoPage({ trail, h1, lede, jsonLd, children, stateSlug, look = 'plain', capture, hero, calm, boxFirst, brand, ask, squiggle }: {
  trail: { name: string; path: string }[]
  h1: string
  lede: ReactNode
  jsonLd?: Record<string, unknown>[]
  children: ReactNode
  /** A state page's slug ("new-york"): the page takes the state's flag colors and opens with the free-assessment offer. */
  stateSlug?: string
  /** 'audience': the shared look for workforce, higher-education and recruiter pages (tinted heading panel, colored stat cards). */
  look?: 'plain' | 'audience' | 'scene'
  /** Adds the journey question and email save under the intro and the owner inquiry at the bottom (components/capture). */
  capture?: PageCaptureConfig
  /** 'scene': the heading sits on a tinted panel beside this picture (public/images/topics), sections are tinted panels and stat cards carry a colored edge. */
  hero?: string
  /** With look 'scene': every section is one quiet white panel instead of four alternating tints (the ranking pages, where the picture carries the colour). */
  calm?: boolean
  /** Puts the next-step box under the heading instead of after the content: for hub pages so long that the box would be thousands of pixels down (the rankings hub). */
  boxFirst?: boolean
  /** The page's organization colors the heading panel: its color as the background and the readable text color on it (a firm's page). */
  brand?: { color: string; ink: string; stripe?: string }
  /** A journey page words the next-step box itself and hands the visitor's situation to onboarding. */
  ask?: JourneyAsk
  /** The hand-drawn line under the headline. On by default, except on a page whose heading panel takes an organization's colors (`brand`); pass false to turn it off. */
  squiggle?: boolean
}) {
  const st = stateBrandFromSlug(stateSlug)
  const pull = pullContext(trail)
  const { body, bottom } = withPullCtas(children, pull, { hasCapture: !!capture, isOwnBand: () => false })
  const page = (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd(trail)} />
      {jsonLd?.map((d, i) => <StructuredData key={i} data={d} />)}
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-8" data-look={look} data-calm={calm ? '' : undefined}>
        <div className="mx-auto max-w-6xl px-6">
          <div style={brand ? { backgroundColor: brand.color, color: brand.ink } : undefined} className={brand ? 'rounded-3xl p-5 sm:p-7' : look === 'audience' ? 'rounded-3xl bg-gradient-to-br from-tint-sky via-white to-tint-sun p-5 sm:p-7' : look === 'scene' && hero ? 'overflow-hidden rounded-3xl bg-gradient-to-br from-tint-sky via-white to-tint-sun md:grid md:grid-cols-[1.15fr_1fr]' : undefined}>
          <div className={look === 'scene' && hero ? 'p-5 sm:p-7' : undefined}>
          <nav aria-label="Breadcrumb" className={brand ? 'text-xs opacity-80' : 'text-xs text-muted-foreground'}>
            {trail.map((t, i) => (
              <span key={t.path}>
                {i > 0 && <span aria-hidden> › </span>}
                {i < trail.length - 1 ? <Link href={t.path} className={brand ? 'underline underline-offset-2' : 'hover:text-foreground'}>{t.name}</Link> : <span className={brand ? undefined : 'text-foreground'}>{t.name}</span>}
              </span>
            ))}
          </nav>
          <h1 className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${brand ? '' : 'text-navy'} ${look === 'audience' ? 'font-display [text-wrap:balance]' : ''}`}>{h1}</h1>
          {(squiggle ?? !brand) && <Squiggle className="mt-2" />}
          <div className={`mt-4 max-w-3xl text-lg ${brand ? '' : 'text-muted-foreground'}`}>{lede}</div>
          </div>
          {look === 'scene' && hero && (
            <div className="relative aspect-[16/7] md:aspect-auto md:min-h-[260px]">
              <Image src={hero} alt="" fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover object-right" />
            </div>
          )}
          {brand?.stripe && <div aria-hidden className="-mx-5 -mb-5 mt-6 h-2 rounded-b-3xl sm:-mx-7 sm:-mb-7" style={{ backgroundColor: brand.stripe }} />}
          </div>
          {st && (
            <OrgCandidateBand
              orgName={stateName(st.code)}
              branded
              peopleCount={null}
              heading={`Looking for work in ${stateName(st.code)}? See where you stand.`}
              independent={`Independent page. Not from or affiliated with ${statePhrase(st.code)}.`}
              properties={{ kind: 'STATE', state: st.code }}
            />
          )}
          {boxFirst && (capture ? <PageCaptureTop capture={capture} /> : !st && <PullCtaTop {...pull} ask={ask} />)}
          {body}
          {!boxFirst && (capture ? <PageCaptureTop capture={capture} /> : !st && <PullCtaTop {...pull} ask={ask} />)}
          {capture && <PageCaptureOwner capture={capture} />}
          {bottom}
        </div>
      </main>
      <PublicSiteFooter page="seo" cta={false} />
    </div>
  )
  return st ? <OrgBrandScope brand={st.brand}>{page}</OrgBrandScope> : page
}

export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <li className="seo-stat rounded-xl border border-border bg-white p-5">
      <p className="seo-stat-value text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </li>
  )
}

/** One action band: what the visitor can do next, with a tracked primary link. */
export function ActionBand({ title, body, label, href, event, properties }: {
  title: string; body: string; label: string; href: string; event: string; properties: Record<string, unknown>
}) {
  return (
    <section className="seo-action mt-12 rounded-xl border border-border bg-white p-6">
      <h2 className="text-xl font-semibold tracking-tight text-navy">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{body}</p>
      <TrackedLink href={href} event={event} properties={properties} className="mt-4 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95">
        <AssessmentCtaLabel>{label}</AssessmentCtaLabel>
      </TrackedLink>
    </section>
  )
}
