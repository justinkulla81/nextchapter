import type { ReactNode } from 'react'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import { OrgCandidateBand } from '@/components/seo/OrgCandidateBand'
import { stateBrandFromSlug, statePhrase } from '@/lib/branding/state-colors'
import { stateName } from '@/lib/seo/states'

export const H2 = 'text-2xl font-bold tracking-tight text-navy'
export const LINK = 'text-brand underline underline-offset-4'

/** The frame for the programmatic public pages (workforce, higher education by state, rapid response, tools). */
export function SeoPage({ trail, h1, lede, jsonLd, children, stateSlug, look = 'plain' }: {
  trail: { name: string; path: string }[]
  h1: string
  lede: ReactNode
  jsonLd?: Record<string, unknown>[]
  children: ReactNode
  /** A state page's slug ("new-york"): the page takes the state's flag colors and opens with the free-assessment offer. */
  stateSlug?: string
  /** 'audience': the shared look for workforce, higher-education and recruiter pages (tinted heading panel, colored stat cards). */
  look?: 'plain' | 'audience'
}) {
  const st = stateBrandFromSlug(stateSlug)
  const page = (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd(trail)} />
      {jsonLd?.map((d, i) => <StructuredData key={i} data={d} />)}
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12" data-look={look}>
        <div className="mx-auto max-w-6xl px-6">
          <div className={look === 'audience' ? 'rounded-3xl bg-gradient-to-br from-tint-sky via-white to-tint-sun p-6 sm:p-10' : undefined}>
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            {trail.map((t, i) => (
              <span key={t.path}>
                {i > 0 && <span aria-hidden> › </span>}
                {i < trail.length - 1 ? <Link href={t.path} className="hover:text-foreground">{t.name}</Link> : <span className="text-foreground">{t.name}</span>}
              </span>
            ))}
          </nav>
          <h1 className={`mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl ${look === 'audience' ? 'font-display [text-wrap:balance]' : ''}`}>{h1}</h1>
          <div className="mt-4 max-w-3xl text-lg text-muted-foreground">{lede}</div>
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
          {children}
        </div>
      </main>
      <PublicSiteFooter page="seo" />
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
        {label}
      </TrackedLink>
    </section>
  )
}
