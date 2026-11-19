import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionIdentity } from '@/lib/supabase/get-current-user'
import { cleanCompanyText } from '@/lib/jobs/public-job-page'
import { SavedJobsView, type SavedJobRow } from '@/components/onboarding/light/SavedJobsView'

export const dynamic = 'force-dynamic'

const SITE = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

// A light member's page (owner decision 2026-11-18): their saved jobs and one next step, the questions. The full member area
// opens once the questions are done (registration is stamped then). Anyone else goes where they belong.
export default async function YourJobsPage() {
  const who = await getSessionIdentity()
  if (!who || who.isAnonymous) redirect('/onboarding')
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: who.id }, select: { id: true, firstName: true, registrationCompletedAt: true, lightAccountAt: true } })
  if (!profile) redirect('/onboarding')
  if (profile.registrationCompletedAt) redirect('/dashboard')

  const tracked = await prisma.trackedJob.findMany({
    where: { candidateId: profile.id, savedAt: { not: null } },
    orderBy: { savedAt: 'desc' },
    take: 20,
    select: { source: true, sourceId: true, title: true, companyName: true, url: true },
  })
  const jobs: SavedJobRow[] = tracked.map((j) => ({
    title: j.title,
    company: cleanCompanyText(j.companyName ?? ''),
    place: null,
    href: j.source === 'job_board' && j.sourceId ? `${SITE()}/jobs/${j.sourceId}` : j.url ?? `${SITE()}/jobs`,
  }))

  return <SavedJobsView firstName={profile.firstName} jobs={jobs} startHref="/onboarding" browseHref={`${SITE()}/jobs`} />
}
