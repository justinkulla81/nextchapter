import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSalaryHistogram, histogramPercentile, histogramShareBelow, isAdzunaInsightsEnabled, memberMarketRole, resolveState } from '@/lib/market/adzuna-insights'
import { payPositionText } from '@/lib/redesign/jobs-pages'
import { EmptyNote, VerdictPanel } from '@/components/candidate/Blocks'

// "Where does my pay sit?": the member's own pay against what employers are
// advertising for their role. An estimate: advertised pay is not what people
// are paid, and it says so. Empty and error states say what to do next.
export async function PayPosition({ candidateId }: { candidateId: string }) {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { lastSalary: true, targetRoleType: true, targetFunction: true, primaryFunction: true, currentState: true },
  })
  if (!p) return null

  const linkCls = 'font-medium text-brand underline underline-offset-4'

  if (!p.lastSalary) {
    return (
      <EmptyNote>
        Add your current pay on your{' '}
        <Link href="/dashboard/profile" className={linkCls}>
          profile
        </Link>{' '}
        and we will show where it sits against what employers are advertising for your role. It stays private.
      </EmptyNote>
    )
  }
  if (!isAdzunaInsightsEnabled()) {
    return <EmptyNote>Market pay data is not available right now. Check back soon.</EmptyNote>
  }
  const role = memberMarketRole(p)
  if (!role) {
    return (
      <EmptyNote>
        Add your role or function on your{' '}
        <Link href="/dashboard/profile" className={linkCls}>
          profile
        </Link>{' '}
        so we can compare your pay with the right market.
      </EmptyNote>
    )
  }

  const state = resolveState(p.currentState)
  const { data: h } = await getSalaryHistogram({ role, state }, { onMiss: 'fetch' })
  if (!h || h.total === 0) {
    return <EmptyNote>We could not find enough advertised pay for {role} to compare yet. Try again in a few minutes.</EmptyNote>
  }
  const share = histogramShareBelow(h, p.lastSalary)
  const p25 = histogramPercentile(h, 0.25)
  const p50 = histogramPercentile(h, 0.5)
  const p75 = histogramPercentile(h, 0.75)

  const t = payPositionText({ pay: p.lastSalary, shareBelow: share, role, place: state ?? null, p25, p50, p75 })
  return <VerdictPanel id="pay-position" title={t.headline} because={t.because} />
}
