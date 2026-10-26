import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { NoExperienceLine } from '@/components/jobs/NoExperienceLine'
import { TrainingProvidedLine } from '@/components/jobs/TrainingProvidedLine'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ApplyAndSave } from '@/components/jobs/ApplyAndSave'
import { applySaveEmailOn } from '@/lib/leads/apply-save-config'
import { StructuredData } from '@/components/StructuredData'
import { PersonalizePanel } from '@/components/home/PersonalizePanel'
import { PublicJobViewTracker } from '@/components/home/PublicJobViewTracker'
import { buttonVariants } from '@/components/ui/button'
import { isExcerpt } from '@/lib/jobs/posting-text'
import { datePostedOf, descriptionParagraphs, isRemoteJob, jobPostingJsonLd, payLabel, placeLabel } from '@/lib/jobs/public-job-page'
import { closedJobRedirectTarget, getPublicJob } from '@/lib/jobs/public-job-page-server'
import { prisma } from '@/lib/prisma'
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
    robots: { index: true, follow: true },
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
  const tags = await prisma.exclusiveJobPosting.findUnique({ where: { id: job.id }, select: { industry: true, targetFunction: true } }).catch(() => null)
  const industry = bucketFromIndustryText(tags?.industry)
  const fn = functionByName(tags?.targetFunction)

  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <StructuredData data={jobPostingJsonLd(job)} />
      <PublicJobViewTracker jobId={job.id} company={job.companyName} remote={remote} hasPay={!!pay} />
      <header>
        <SiteNav />
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Search all jobs
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_21rem]">
          <article className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{job.title}</h1>
            <p className="mt-2 text-lg">{job.companyName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[place, pay, `Posted ${dateFmt.format(datePostedOf(job))}`].filter(Boolean).join(' · ')}
            </p>
            <NoExperienceLine jobId={job.id} signals={job.postingSignals} phrase={job.noExperiencePhrase} surface="public_job" className="mt-3 text-base" />
            <TrainingProvidedLine jobId={job.id} signals={job.postingSignals} phrase={job.trainingPhrase} surface="public_job" className="mt-3 text-base" />

            <ApplyAndSave jobId={job.id} company={job.companyName} applyUrl={job.url} emailOn={applySaveEmailOn()} />

            {(industry || fn) && (
              <p className="mt-6 text-sm text-muted-foreground">
                More in{' '}
                {industry && <Link href={industryPath(industry)} className="underline underline-offset-4">{industry}</Link>}
                {industry && fn && ' · '}
                {fn && <Link href={functionPath(fn.name)} className="underline underline-offset-4">{fn.name} jobs</Link>}
              </p>
            )}

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

          <PersonalizePanel
            heading="Know if you fit before you apply"
            intro="Add your résumé once. With a free profile you get:"
            positive
            cta="Show me my fit"
            properties={{ placement: 'job_page', jobId: job.id }}
            mobileFirst={false}
          />
        </div>
      </main>
    </div>
  )
}
