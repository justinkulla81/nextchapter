import type { Metadata } from 'next'
import { getEmployerBrand } from '@/lib/branding/store'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { NoExperienceLine } from '@/components/jobs/NoExperienceLine'
import { TrainingProvidedLine } from '@/components/jobs/TrainingProvidedLine'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ApplyAndSave } from '@/components/jobs/ApplyAndSave'
import { applySaveEmailOn } from '@/lib/leads/apply-save-config'
import { lifecycleEmailsOn } from '@/lib/leads/lifecycle/config'
import { StructuredData } from '@/components/StructuredData'
import { PayVsMarket } from '@/components/jobs/PayVsMarket'
import { JobFitCard } from '@/components/jobs/JobFitCard'
import { PublicJobViewTracker } from '@/components/home/PublicJobViewTracker'
import { buttonVariants } from '@/components/ui/button'
import { isExcerpt } from '@/lib/jobs/posting-text'
import { datePostedOf, descriptionParagraphs, isIndexableJob, isRemoteJob, jobPostingJsonLd, payLabel, placeLabel } from '@/lib/jobs/public-job-page'
import { closedJobRedirectTarget, getPublicJob } from '@/lib/jobs/public-job-page-server'
import { employerPath, isCompanyOfferedToSearch } from '@/lib/seo/employer-pages'
import { prisma } from '@/lib/prisma'
import { BrowseTheSite } from '@/components/marketing/BrowseTheSite'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { bucketFromIndustryText, functionByName, functionPath, industryPath } from '@/lib/seo/topics'
import { cn } from '@/lib/utils'

// A public, indexable page for one live job, with Google for Jobs structured data.
// Which jobs get one: the allowlist in src/lib/jobs/public-job-page.ts. Every other id —
// closed, private, unverified, unknown — is a 404 (notFound(), ./not-found.tsx), so
// Google drops a page once its job closes. Rendered on first request and cached (ISR);
// one primary-key read per render. No IP rate limit: crawlers must be able to read it.

export const revalidate = 21600 // 6 hours
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

type Params = Promise<{ id: string }>

const loadJob = cache((id: string) => getPublicJob(id))

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const job = await loadJob(id)
  if (!job) return { title: 'Job not found', robots: { index: false, follow: true } }
  const place = placeLabel(job)
  const lead = descriptionParagraphs(job.description).join(' ').slice(0, 150).trim()
  return {
    title: `${job.title} at ${job.companyName}${place ? ` · ${place}` : ''}`,
    description: `${job.companyName} is hiring a ${job.title}${place ? ` (${place})` : ''}. ${lead}…`,
    alternates: { canonical: `/jobs/${job.id}` },
    // A job with only a snippet of the posting stays visible to visitors but is kept out of search (see isIndexableJob).
    robots: { index: isIndexableJob(job), follow: true },
  }
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default async function PublicJobPage({ params }: { params: Params }) {
  const { id } = await params
  const job = await loadJob(id)
  if (!job) {
    // A job that closed hands its page's value to the employer's page (or its function or industry page).
    // Anything else is a plain 404.
    const to = await closedJobRedirectTarget(id)
    if (to) permanentRedirect(to)
    notFound()
  }

  const place = placeLabel(job)
  const pay = payLabel(job.salaryMin, job.salaryMax, job.payPeriod)
  const paragraphs = descriptionParagraphs(job.description)
  // Rows imported before full text was kept still hold a ~1,000-character excerpt until
  // their next import; only those point to the employer's page for the rest.
  const excerpt = isExcerpt(job.description)
  const remote = isRemoteJob(job)
  // Where the job sits on the industry and function pages. A failed read just leaves the links out.
  const tags = await prisma.exclusiveJobPosting
    .findUnique({ where: { id: job.id }, select: { industry: true, targetFunction: true, company: { select: { id: true, canonicalNameNormalized: true } } } })
    .catch(() => null)
  // The employer's own page lists every open role it has; link to it when that page is offered to search engines.
  const employerHref =
    tags?.company && (await isCompanyOfferedToSearch(tags.company.id).catch(() => false)) ? employerPath(tags.company.canonicalNameNormalized, tags.company.id) : null
  const industry = bucketFromIndustryText(tags?.industry)
  const fn = functionByName(tags?.targetFunction)
  // The employer's own colors, read from its website (src/lib/branding): a thin strip and the company name only; the buttons stay ours.
  const brand = await getEmployerBrand(job.companyName)

  return (
    <OrgBrandScope brand={brand?.pair}>
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <StructuredData data={jobPostingJsonLd(job)} />
      <PublicJobViewTracker jobId={job.id} company={job.companyName} remote={remote} hasPay={!!pay} />
      <header>
        <SiteNav />
      </header>

      {brand && <div aria-hidden className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, var(--org-1) 75%, var(--org-2) 75%)' }} />}
      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Search all jobs
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
          <article className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{job.title}</h1>
            <p className="mt-2 text-lg" style={brand ? { color: 'var(--org-1-text)' } : undefined}>{job.companyName}</p>
            {brand && <p className="mt-0.5 text-xs text-muted-foreground">Listing collected from {job.companyName}&apos;s career site. NextChapter is independent of {job.companyName}.</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              {[place, pay, `Posted ${dateFmt.format(datePostedOf(job))}`].filter(Boolean).join(' · ')}
            </p>
            <NoExperienceLine jobId={job.id} signals={job.postingSignals} phrase={job.noExperiencePhrase} surface="public_job" className="mt-3 text-base" />
            <TrainingProvidedLine jobId={job.id} signals={job.postingSignals} phrase={job.trainingPhrase} surface="public_job" className="mt-3 text-base" />

            <ApplyAndSave jobId={job.id} company={job.companyName} applyUrl={job.url} emailOn={applySaveEmailOn() || lifecycleEmailsOn()} reminderOn={lifecycleEmailsOn()} />

            {employerHref && (
              <p className="mt-6 text-sm">
                <TrackedLink
                  href={employerHref}
                  event="public_job_employer_link_clicked"
                  properties={{ jobId: job.id, company: job.companyName }}
                  className="font-medium text-brand underline underline-offset-4"
                >
                  See every open role at {job.companyName}
                </TrackedLink>
              </p>
            )}

            {(industry || fn || job.locationState) && (
              <p className="mt-6 text-sm text-muted-foreground">
                More in{' '}
                {job.locationState && ALL_STATE_CODES.includes(job.locationState) && (
                  <>
                    <Link href={`/places/${stateSlug(job.locationState)}`} className="underline underline-offset-4">{stateName(job.locationState)} job market</Link>
                    {(industry || fn) && ' · '}
                  </>
                )}
                {industry && <Link href={industryPath(industry)} className="underline underline-offset-4">{industry}</Link>}
                {industry && fn && ' · '}
                {fn && <Link href={functionPath(fn.name)} className="underline underline-offset-4">{fn.name} jobs</Link>}
              </p>
            )}

            <PayVsMarket jobId={job.id} title={job.title} salaryMin={job.salaryMin} salaryMax={job.salaryMax} payPeriod={job.payPeriod} />

            <h2 className="mt-10 font-display text-xl font-semibold">About the job</h2>
            <div className="mt-3 space-y-4 text-[15px] leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
            {excerpt && (
              <p className="mt-4 text-sm text-muted-foreground">
                This is the start of the posting.{' '}
                <TrackedLink
                  href={job.url}
                  rel="nofollow"
                  event="public_job_apply_clicked"
                  properties={{ jobId: job.id, company: job.companyName, placement: 'read_more' }}
                  className="font-semibold text-brand underline underline-offset-4"
                >
                  Read the full posting on the employer&apos;s site
                </TrackedLink>
              </p>
            )}
          </article>

          <JobFitCard jobId={job.id} placement="side" className="hidden h-fit lg:sticky lg:top-6 lg:block" />
        </div>
        <BrowseTheSite />
      </main>
    </div>
    </OrgBrandScope>
  )
}
