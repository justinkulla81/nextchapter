import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getOfferedWagesForMember } from '@/lib/market/offered-wages-for-member'
import { pooledMedian, totalFilings } from '@/lib/market/offered-wage-match'
import { EmptyNote, FactList, PlainNote, SourceLine } from '@/components/candidate/Blocks'
import { shortMoney } from '@/lib/redesign/jobs-pages'

// "What employers have filed to pay": public wage filings (DOL) for occupations
// like the member's role, across all employers and for the companies they
// track. Filed wages cover roles that sponsor visas, so this is a second
// signal beside advertised pay, never a verdict on what someone should earn.
export async function OfferedWagesSection({ candidateId }: { candidateId: string }) {
  const data = await getOfferedWagesForMember(candidateId).catch(() => null)
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { lastSalary: true } })

  if (!data) {
    return (
      <EmptyNote>
        Add your role on your{' '}
        <Link href="/dashboard/profile" className="font-medium text-brand underline underline-offset-4">
          profile
        </Link>{' '}
        to see what employers have filed to pay for it.
      </EmptyNote>
    )
  }
  if (data.across.length === 0) {
    return <EmptyNote>We have no public wage filings for roles like {data.role} yet. That is common for roles that do not sponsor visas.</EmptyNote>
  }
  return (
    <OfferedWagesView
      role={data.role}
      filings={totalFilings(data.across)}
      lo={pooledMedian(data.across, 'wageP25')}
      mid={pooledMedian(data.across, 'wageMedian')}
      hi={pooledMedian(data.across, 'wageP75')}
      lastSalary={p?.lastSalary ?? null}
      tracked={data.tracked.slice(0, 3).map((r) => ({ employer: r.employerName, occupation: r.socTitle, median: r.wageMedian, filings: r.filings, topState: r.topState ?? null }))}
    />
  )
}

export interface OfferedWagesViewProps {
  role: string
  filings: number
  lo: number | null
  mid: number | null
  hi: number | null
  lastSalary: number | null
  tracked: { employer: string; occupation: string; median: number; filings: number; topState: string | null }[]
}

// The read of public wage filings: one sentence that says what employers filed to pay, the fact it rests on, and at most three tracked companies.
export function OfferedWagesView({ role, filings, lo, mid, hi, lastSalary, tracked }: OfferedWagesViewProps) {
  return (
    <div className="space-y-3">
      <PlainNote>
        <span className="font-semibold">Employers filed to pay around {mid ? shortMoney(mid) : 'an amount we cannot show'}</span>
        {lo && hi ? `, typically ${shortMoney(lo)} to ${shortMoney(hi)}` : ''}, for occupations like {role}.
        {lastSalary && mid ? ` Your pay is ${lastSalary >= mid ? 'at or above' : 'below'} that middle figure.` : ''}
      </PlainNote>
      <SourceLine>
        Across {filings.toLocaleString()} public Department of Labor wage filings. They cover roles that sponsor work visas and name an occupation, not your exact title, so treat this as an estimate to anchor a conversation.
      </SourceLine>
      {tracked.length > 0 && (
        <FactList
          label="Companies you track"
          items={tracked.map((r) => ({
            key: `${r.employer}-${r.occupation}`,
            name: (
              <>
                <span className="font-semibold">{r.employer}</span> for {r.occupation.toLowerCase()}
              </>
            ),
            fact: `${shortMoney(r.median)} typical, ${r.filings.toLocaleString()} filings${r.topState ? `, mostly ${r.topState}` : ''}`,
          }))}
        />
      )}
    </div>
  )
}
