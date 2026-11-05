import type { Metadata } from 'next'
import { getEmployerBrand, employerBrandKey } from '@/lib/branding/store'
import { brandOrFallback } from '@/lib/branding/fallback'
import { OrgBrandScope } from '@/components/branding/OrgBrandScope'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { NoExperienceLine } from '@/components/jobs/NoExperienceLine'
import { TrainingProvidedLine } from '@/components/jobs/TrainingProvidedLine'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { ApplyAndSave } from '@/components/jobs/ApplyAndSave'
import { MemberSignInPrompt } from '@/components/jobs/MemberSignInPrompt'
import { ReadFullPostingLink } from '@/components/jobs/ReadFullPostingLink'
import { applySaveEmailOn } from '@/lib/leads/apply-save-config'
import { lifecycleEmailsOn } from '@/lib/leads/lifecycle/config'
import { StructuredData } from '@/components/StructuredData'
import { PayVsMarket } from '@/components/jobs/PayVsMarket'
import { JobAiExposure } from '@/components/jobs/JobAiExposure'
import { EmployerLayoffLine } from '@/components/jobs/EmployerLayoffLine'
import { JobFitCard } from '@/components/jobs/JobFitCard'
import { RecruiterAsk } from '@/components/jobs/RecruiterAsk'
import { showRecruiterAsk } from '@/lib/jobs/recruiter-ask'
import { PublicJobViewTracker } from '@/components/home/PublicJobViewTracker'
import { buttonVariants } from '@/components/ui/button'
import { isExcerpt } from '@/lib/jobs/posting-text'
import { testedTitle } from '@/lib/seo/title-test-state'
import { jobTitleB } from '@/lib/seo/title-tests'
import { datePostedOf, descriptionParagraphs, isIndexableJob, isRemoteJob, jobPostingJsonLd, payLabel, placeLabel } from '@/lib/jobs/public-job-page'
import { getPublicJob } from '@/lib/jobs/public-job-page-server'
import { employerPath, isCompanyOfferedToSearch } from '@/lib/seo/employer-pages'
import { prisma } from '@/lib/prisma'
import { getTitleIndex } from '@/lib/seo/job-titles'
import { baseTitle, titleSlug } from '@/lib/seo/job-title-rules'
import { BrowseTheSite } from '@/components/marketing/BrowseTheSite'
import { RankingContext } from '@/components/rankings/RankingContext'
import { cityAwardKeys } from '@/lib/rankings/place-keys'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { bucketFromIndustryText, functionByName, functionPath, industryPath } from '@/lib/seo/topics'
import { cn } from '@/lib/utils'
import { ClaimSkills } from '@/components/skills/ClaimSkills'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { skillsForPosting } from '@/lib/skills/for-job'

// A public, indexable page for one live job, with Google for Jobs structured data.
// Which jobs get one: the allowlist in src/lib/jobs/public-job-page.ts. Every other id —
// closed, private, unverified, unknown — is a 404 (notFound(), ./not-found.tsx), so
// Google drops a page once its job closes. Rendered on first request and cached (ISR);
// one primary-key read per render. No IP rate limit: crawlers must be able to read it.

export const revalidate = 259200 // 3 days: this route was two thirds of ISR writes (Oct 23-30); a closed job now stays up to 3 days
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
    title: await testedTitle(
      'jobs',
      `/jobs/${job.id}`,
      `${job.title} at ${job.companyName}${place ? ` · ${place}` : ''}`,
      jobTitleB(job.title, job.companyName, place, payLabel(job.salaryMin, job.salaryMax, job.payPeriod)),
    ),
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
  // A closed job answers 404 (not a redirect to another page, which Google counts as a soft 404 for job postings), so it leaves Google for Jobs.
  if (!job) notFound()

  const place = placeLabel(job)
  const pay = payLabel(job.salaryMin, job.salaryMax, job.payPeriod)
  const paragraphs = descriptionParagraphs(job.description)
  // Rows imported before full text was kept still hold a ~1,000-character excerpt until
  // their next import; only those point to the employer's page for the rest.
  const excerpt = isExcerpt(job.description)
  const remote = isRemoteJob(job)
  // Where the job sits on the industry and function pages. A failed read just leaves the links out.
  const tags = await prisma.exclusiveJobPosting
    .findUnique({ where: { id: job.id }, select: { industry: true, targetFunction: true, socCode: true, level: true, skills: true, company: { select: { id: true, canonicalNameNormalized: true, sizeBand: true } } } })
    .catch(() => null)
  // The employer's own page lists every open role it has; link to it when that page is offered to search engines.
  const employerHref =
    tags?.company && (await isCompanyOfferedToSearch(tags.company.id).catch(() => false)) ? employerPath(tags.company.canonicalNameNormalized, tags.company.id) : null
  // The title's own page lists every open role with this title; it exists only for titles with enough listings. A failed read just leaves the link out.
  const titleStat = (await getTitleIndex().catch(() => [])).find((t) => t.slug === titleSlug(baseTitle(job.title)))
  const industry = bucketFromIndustryText(tags?.industry)
  const fn = functionByName(tags?.targetFunction)
  // The skills this posting names that have a skills page, most asked for first. A failed read just leaves the section out.
  const jobSkills = skillsForPosting(tags?.skills ?? [], await loadSkillsMarket().catch(() => null))
  // The employer's own colors, read from its website (src/lib/branding): a thin strip and the company name only; the buttons stay ours.
  const realBrand = await getEmployerBrand(job.companyName)
  const brand = brandOrFallback(realBrand, employerBrandKey(job.companyName))
  // Director and up at a big company, VP and up at a small one: ask whether they want recruiters in this space (src/lib/jobs/recruiter-ask.ts).
  const recruiterSpace = fn?.name ?? industry ?? baseTitle(job.title)
  const askRecruiters = showRecruiterAsk({ title: job.title, description: job.description, companyName: job.companyName, level: tags?.level }, tags?.company?.sizeBand)

  return (
    <OrgBrandScope brand={brand?.pair}>
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <StructuredData data={jobPostingJsonLd(job)} />
      <PublicJobViewTracker jobId={job.id} company={job.companyName} remote={remote} hasPay={!!pay} />
      <MemberSignInPrompt jobId={job.id} company={job.companyName} />
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
            {realBrand && <p className="mt-0.5 text-xs text-muted-foreground">Listing collected from {job.companyName}&apos;s career site. NextChapter is independent of {job.companyName}.</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              {[place, pay, `Posted ${dateFmt.format(datePostedOf(job))}`].filter(Boolean).join(' · ')}
            </p>
            <NoExperienceLine jobId={job.id} signals={job.postingSignals} phrase={job.noExperiencePhrase} surface="public_job" className="mt-3 text-base" />
            <TrainingProvidedLine jobId={job.id} signals={job.postingSignals} phrase={job.trainingPhrase} surface="public_job" className="mt-3 text-base" />

            <ApplyAndSave jobId={job.id} company={job.companyName} jobTitle={job.title} industry={industry} applyUrl={job.url} emailOn={applySaveEmailOn() || lifecycleEmailsOn()} reminderOn={lifecycleEmailsOn()} />

            <p className="mt-4 text-sm text-muted-foreground">
              Just laid off?{' '}
              <TrackedLink
                href="/start/laid-off"
                event="job_page_laid_off_prompt_clicked"
                properties={{ jobId: job.id, company: job.companyName, placement: 'under_apply' }}
                className="font-medium text-brand underline underline-offset-4"
              >
                Start here: a plan for the first weeks
              </TrackedLink>
            </p>

            {askRecruiters && <RecruiterAsk jobId={job.id} company={job.companyName} space={recruiterSpace} />}

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

            {(titleStat || industry || fn || job.locationState) && (
              <p className="mt-6 text-sm text-muted-foreground">
                More in{' '}
                {job.locationState && ALL_STATE_CODES.includes(job.locationState) && (
                  <>
                    <Link href={`/places/${stateSlug(job.locationState)}`} className="underline underline-offset-4">{stateName(job.locationState)} job market</Link>
                    {(titleStat || industry || fn) && ' · '}
                  </>
                )}
                {titleStat && (
                  <>
                    <Link href={`/jobs/title/${titleStat.slug}`} className="underline underline-offset-4">All {titleStat.name} jobs ({titleStat.jobs.toLocaleString('en-US')})</Link>
                    {(industry || fn) && ' · '}
                  </>
                )}
                {industry && <Link href={industryPath(industry)} className="underline underline-offset-4">{industry}</Link>}
                {industry && fn && ' · '}
                {fn && <Link href={functionPath(fn.name)} className="underline underline-offset-4">{fn.name} jobs</Link>}
              </p>
            )}

            <RankingContext
              surface="job"
              places={job.locationCity && job.locationState ? [{ name: `${job.locationCity}, ${job.locationState}`, keys: cityAwardKeys(job.locationCity, job.locationState) }] : []}
              fn={tags?.targetFunction}
            />

            <PayVsMarket jobId={job.id} title={job.title} salaryMin={job.salaryMin} salaryMax={job.salaryMax} payPeriod={job.payPeriod} />

            <JobAiExposure jobId={job.id} socCode={tags?.socCode} />
            <EmployerLayoffLine jobId={job.id} company={job.companyName} />

            {jobSkills.length > 0 && (
              <section aria-labelledby="job-skills" className="mt-10">
                <h2 id="job-skills" className="font-display text-xl font-semibold">Skills this job asks for</h2>
                <p className="mt-1 text-sm text-muted-foreground">Say which you have and which you want to build. We use it to match you to jobs like this one.</p>
                <div className="mt-3"><ClaimSkills skills={jobSkills} source="job_page" /></div>
              </section>
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
                <ReadFullPostingLink href={job.url} jobId={job.id} company={job.companyName} />
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
