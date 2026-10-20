import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSalaryHistogram, histogramPercentile, histogramShareBelow, isAdzunaInsightsEnabled, memberMarketRole, resolveState } from '@/lib/market/adzuna-insights'
import { EstimateTag } from '@/components/ui/estimate-tag'
import { payPositionText } from '@/lib/redesign/jobs-pages'
import { EmptyNote, VerdictPanel } from '@/components/candidate/Blocks'

// Redesigned pages say the same things in reading-size words with no box; the legacy look is unchanged.
function Note({ redesign, children }: { redesign: boolean; children: React.ReactNode }) {
  return redesign ? <EmptyNote>{children}</EmptyNote> : <p className="text-sm text-muted-foreground">{children}</p>
}

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

// "Where does my pay sit?": the member's own pay against what employers are
// advertising for their role. An estimate: advertised pay is not what people
// are paid, and it says so. Empty and error states say what to do next.
export async function PayPosition({ candidateId, redesign = false }: { candidateId: string; redesign?: boolean }) {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { lastSalary: true, targetRoleType: true, targetFunction: true, primaryFunction: true, currentState: true },
  })
  if (!p) return null

  // Redesigned pages say the same things in reading-size words with no box; the legacy look is unchanged below.
  const linkCls = redesign ? 'font-medium text-brand underline underline-offset-4' : 'text-primary underline underline-offset-4'

  if (!p.lastSalary) {
    return (
      <Note redesign={redesign}>
        Add your current pay on your{' '}
        <Link href="/dashboard/profile" className={linkCls}>
          profile
        </Link>{' '}
        and we will show where it sits against what employers are advertising for your role. It stays private.
      </Note>
    )
  }
  if (!isAdzunaInsightsEnabled()) {
    return <Note redesign={redesign}>Market pay data is not available right now. Check back soon.</Note>
  }
  const role = memberMarketRole(p)
  if (!role) {
    return (
      <Note redesign={redesign}>
        Add your role or function on your{' '}
        <Link href="/dashboard/profile" className={linkCls}>
          profile
        </Link>{' '}
        so we can compare your pay with the right market.
      </Note>
    )
  }

  const state = resolveState(p.currentState)
  const { data: h } = await getSalaryHistogram({ role, state }, { onMiss: 'fetch' })
  if (!h || h.total === 0) {
    return <Note redesign={redesign}>We could not find enough advertised pay for {role} to compare yet. Try again in a few minutes.</Note>
  }
  const share = histogramShareBelow(h, p.lastSalary)
  const p25 = histogramPercentile(h, 0.25)
  const p50 = histogramPercentile(h, 0.5)
  const p75 = histogramPercentile(h, 0.75)

  if (redesign) {
    const t = payPositionText({ pay: p.lastSalary, shareBelow: share, role, place: state ?? null, p25, p50, p75 })
    return <VerdictPanel id="pay-position" title={t.headline} because={t.because} />
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        Your pay of <span className="font-semibold">{money(p.lastSalary)}</span> is above about{' '}
        <span className="font-semibold">{share === null ? '—' : `${Math.round(share * 100)}%`}</span> of advertised salaries for{' '}
        {role} in {state ?? 'the US'}.
        <EstimateTag />
      </p>
      {p25 !== null && p50 !== null && p75 !== null && (
        <p className="text-sm text-muted-foreground">
          The middle half runs {money(p25)} to {money(p75)}, around {money(p50)} in the middle. Advertised pay is not what people are
          paid, so use it to start the conversation, not to end it.
        </p>
      )}
    </div>
  )
}
