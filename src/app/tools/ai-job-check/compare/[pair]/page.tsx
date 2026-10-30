import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect, redirect } from 'next/navigation'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { comparePath, listedPair, pairFromSlug, pairsWith, readingOf, titleOf, type Figures } from '@/lib/ai-check/compare'
import { checkPath } from '@/lib/ai-check/slug'
import { prisma } from '@/lib/prisma'
import { loadExposureForSoc } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, bandOf, scorePercent } from '@/lib/skills/ai-exposure'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'

// Two related jobs side by side: AI exposure, pay and openings. Built on first visit and cached a day, like the occupation
// pages; the list of pairs is committed (compare-pairs.json), so nothing here is read at build time.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const usd = (n: number | null) => (n ? `$${n.toLocaleString('en-US')}` : 'Not published')

async function loadFigures(soc6: string): Promise<Figures | null> {
  const e = await loadExposureForSoc(soc6)
  if (!e) return null
  const occ = await prisma.occupation
    .findUnique({ where: { socCode: `${soc6}.00` }, select: { medianWage: true, growthPct: true, annualOpenings: true } })
    .catch((error) => {
      console.error('AI job check compare: occupation unavailable:', error)
      return null
    })
  return { soc6, title: e.title, score: e.score, medianWage: occ?.medianWage ?? null, growthPct: occ?.growthPct ?? null, annualOpenings: occ?.annualOpenings ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params
  const codes = pairFromSlug(pair)
  const listed = codes && listedPair(codes[0], codes[1])
  const ta = listed && titleOf(listed[0])
  const tb = listed && titleOf(listed[1])
  if (!listed || !ta || !tb) return { title: 'AI job check', robots: { index: false, follow: true } }
  const path = comparePath(listed[0], listed[1])!
  const title = `${ta} vs ${tb}: AI Exposure, Pay and Openings`
  const description = `${ta} and ${tb} side by side: the share of tasks that already see AI use, median pay and yearly openings, from the Anthropic Economic Index and BLS.`
  return {
    title: titleMeta(title),
    description,
    ...canonical(path),
    openGraph: { type: 'website', siteName: 'NextChapter', locale: 'en_US', title, description, url: `${SITE_URL}${path}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params
  const codes = pairFromSlug(pair)
  const listed = codes && listedPair(codes[0], codes[1])
  if (!listed) redirect('/tools/ai-job-check')
  const path = comparePath(listed[0], listed[1])!
  if (`/tools/ai-job-check/compare/${pair}` !== path) permanentRedirect(path)
  const [a, b] = await Promise.all(listed.map(loadFigures))
  if (!a || !b) redirect('/tools/ai-job-check')

  const reading = readingOf(a, b)
  const allRows: { label: string; cell: (f: Figures) => string; has: (f: Figures) => boolean }[] = [
    { label: 'Tasks that already see AI use', cell: (f) => `${scorePercent(f.score)} (${BAND_LABEL[bandOf(f.score)]})`, has: () => true },
    { label: 'Median pay a year', cell: (f) => usd(f.medianWage), has: (f) => Boolean(f.medianWage) },
    { label: 'Projected growth', cell: (f) => (f.growthPct != null ? `${f.growthPct > 0 ? '+' : ''}${f.growthPct}%` : 'Not published'), has: (f) => f.growthPct != null },
    { label: 'Openings a year', cell: (f) => (f.annualOpenings ? f.annualOpenings.toLocaleString('en-US') : 'Not published'), has: (f) => Boolean(f.annualOpenings) },
  ]
  // A row where neither job has a published figure says nothing, so it is left out.
  const rows = allRows.filter((r) => r.has(a) || r.has(b))
  const related = [
    ...pairsWith(a.soc6).filter((s) => s !== b.soc6).map((s) => ({ from: a, other: s })),
    ...pairsWith(b.soc6).filter((s) => s !== a.soc6).map((s) => ({ from: b, other: s })),
  ]
    .flatMap(({ from, other }) => {
      const href = comparePath(from.soc6, other)
      const t = titleOf(other)
      return href && t ? [{ href, label: `${from.title} vs ${t}` }] : []
    })
    .slice(0, 6)
  const heading = `${a.title} vs ${b.title}: AI exposure, pay and openings`

  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'AI job check', path: '/tools/ai-job-check' }, { name: `${a.title} vs ${b.title}`, path }]}
      h1={heading}
      lede={
        <div className="max-w-3xl">
          <p className="text-base">{reading}</p>
          <p className="mt-2 text-sm text-muted-foreground">{EXPOSURE_WHY}</p>
        </div>
      }
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'WebPage', name: heading, url: `${SITE_URL}${path}`, citation: AI_EXPOSURE_SOURCE.url }]}
    >
      <section aria-labelledby="table" className="mt-10 max-w-3xl">
        <h2 id="table" className={H2}>Side by side</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-3"><span className="sr-only">Measure</span></th>
                {[a, b].map((f) => (
                  <th key={f.soc6} scope="col" className="p-3 font-semibold text-navy">
                    <Link href={checkPath(f.title, f.soc6)} className={LINK}>{f.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <th scope="row" className="p-3 font-medium text-muted-foreground">{r.label}</th>
                  <td className="p-3 text-navy">{r.cell(a)}</td>
                  <td className="p-3 text-navy">{r.cell(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Exposure: <a href={AI_EXPOSURE_SOURCE.url} className={LINK} rel="noopener">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}. Pay, growth and openings: Bureau of Labor Statistics.
        </p>
      </section>

      <section aria-labelledby="pages" className="mt-10 max-w-3xl">
        <h2 id="pages" className={H2}>The full check for each job</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[a, b].map((f) => (
            <li key={f.soc6}>
              <TrackedLink href={checkPath(f.title, f.soc6)} event="ai_job_compare_link_clicked" properties={{ pair, soc6: f.soc6, target: 'occupation' }} className={LINK}>
                {f.title}: tasks, related jobs and skills to build
              </TrackedLink>
            </li>
          ))}
        </ul>
        <TrackedLink
          href={MARKET_REALITY_START_HREF}
          event="ai_job_compare_cta_clicked"
          properties={{ pair, cta: 'assessment' }}
          className="mt-5 inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          Get my free assessment
        </TrackedLink>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="more" className="mt-10 max-w-3xl">
          <h2 id="more" className={H2}>More comparisons</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className={LINK}>{r.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </SeoPage>
  )
}
