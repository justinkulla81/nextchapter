import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { PlainNote, SectionBlock } from '@/components/candidate/Blocks'
import { WORK_VALUE_DOMAIN_LABELS, type WorkValueDomain } from '@/lib/constants/what-i-need'
import { PackageWishesForm } from '@/components/market/PackageWishesForm'
import type { PackageBenefitKey, PackageNumberKey } from '@/lib/review-prep/package-wishes'

// Know your worth in the redesign: one verdict on where the member's pay sits, a second signal from public filings,
// and what to ask for besides money. The market chart and the package wishes sit behind "Show more".
// The data-bound parts arrive as slots so the page can stream them and the dev-preview can fill them with samples.
export function PayRedesign({
  position,
  filed,
  top,
  wishes,
  market,
}: {
  position: ReactNode
  filed: ReactNode
  top: WorkValueDomain[]
  /** What the member ticked and typed for the package, to edit in place. */
  wishes: { benefits: PackageBenefitKey[]; numbers: Record<PackageNumberKey, number | null> }
  /** The advertised-pay chart for the member's role, or null when it is switched off. */
  market: ReactNode | null
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Know your worth"
        intro="What roles like yours pay, so you can aim well and ask with facts. Private to you."
        action={
          <ActionLink href="/dashboard/review-prep" kind="primary" event="pay_build_case_clicked" props={{ source: 'pay', hasPriorities: top.length > 0 }}>
            Build your case for the conversation
          </ActionLink>
        }
      />
      {position}
      <SectionBlock id="filed" title="What employers have filed to pay" why="A second signal beside advertised pay, from public records.">
        {filed}
      </SectionBlock>
      <SectionBlock id="besides-pay" title="What matters besides pay">
        {top.length > 0 ? (
          <PlainNote>
            You said you will not trade away <span className="font-semibold">{top.map((d) => WORK_VALUE_DOMAIN_LABELS[d]).join(', ')}</span>. Ask for these as well as money; they are often easier to
            get.{' '}
            <Link href="/dashboard/what-i-need" className="text-sm font-medium text-brand underline underline-offset-4">
              Update what you need
            </Link>
          </PlainNote>
        ) : (
          <PlainNote>
            Pay is only part of a good offer. Tell us what you will not trade away and we will remind you to ask for it.{' '}
            <Link href="/dashboard/what-i-need" className="text-sm font-medium text-brand underline underline-offset-4">
              Take What I Need (about 10 minutes)
            </Link>
          </PlainNote>
        )}
      </SectionBlock>
      <ShowMore page="pay">
        <SectionBlock id="asks" title="What you want in the package" why="Tick what matters. It becomes your list of things to ask for, in the conversation you build above.">
          <PackageWishesForm initialBenefits={wishes.benefits} initialNumbers={wishes.numbers} />
        </SectionBlock>
        {market && (
          <SectionBlock id="market" title="The market for your role">
            {market}
          </SectionBlock>
        )}
      </ShowMore>
    </div>
  )
}
