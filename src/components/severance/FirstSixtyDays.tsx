import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COBRA, MARKETPLACE } from '@/lib/cobra-aca/rules'
import { WAIVER, WARN } from '@/lib/severance/rules'

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

/**
 * Unemployment, severance and health coverage run on different clocks that all start on the last day of work. This puts them in the order a
 * person meets them, in one list, with the dates the sources give. It uses the state's waiting-week fact and links its own COBRA vs ACA page.
 */
export function FirstSixtyDays({
  name,
  slug,
  waitingWeek,
  agency,
  fileUrl,
  stateCode,
}: {
  name: string
  slug: string
  waitingWeek: boolean | null
  agency: string
  fileUrl: string | null
  stateCode: string
}) {
  const waiting =
    waitingWeek === true
      ? ` ${name} has an unpaid waiting week, so the sooner you file the sooner it starts.`
      : waitingWeek === false
        ? ` ${name} has no unpaid waiting week.`
        : ''
  return (
    <section aria-labelledby="sixty" className="mt-12">
      <h2 id="sixty" className={H2}>Your first 60 days in {name}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Four clocks start when you lose your job. In the order you will meet them:</p>
      <ol className="mt-4 max-w-3xl list-decimal space-y-4 pl-5 text-base leading-relaxed">
        <li>
          <span className="font-semibold text-navy">This week: file for unemployment.</span> Most states pay only from the week you file, even if you got severance.{waiting}{' '}
          {fileUrl && (
            <TrackedLink href={fileUrl} event="benefits_file_claim_clicked" properties={{ state: stateCode, placement: 'timeline' }} className={LINK}>
              File with {agency}
            </TrackedLink>
          )}
        </li>
        <li>
          <span className="font-semibold text-navy">Before you sign a severance agreement: read the clock on it.</span> If you are {WAIVER.minAge} or older, a release of age-discrimination claims must give you
          at least {WAIVER.considerDays} days to consider it ({WAIVER.considerDaysGroup} days if it is part of a group layoff program) and {WAIVER.revokeDays} days to change your mind after you sign. See{' '}
          <Link href="/resources/severance-pay#agreement" className={LINK}>the agreement rules</Link>.
        </li>
        <li>
          <span className="font-semibold text-navy">Within {COBRA.electionDays} days: choose health coverage.</span> You have {COBRA.electionDays} days to elect COBRA and {MARKETPLACE.specialEnrollmentDays} days to
          join a Marketplace plan. Severance and unemployment pay count as income for any Marketplace credit.{' '}
          <Link href={`/resources/cobra-aca/${slug}`} className={LINK}>COBRA vs ACA in {name}</Link>.
        </li>
        <li>
          <span className="font-semibold text-navy">Check whether you were owed notice.</span> Employers with {WARN.minEmployees} or more employees must give {WARN.noticeDays} days’ written notice of a plant
          closing or mass layoff. See the <Link href="/tools/warn-act-checker" className={LINK}>WARN Act checker</Link>.
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">
        Taxes: unemployment benefits are taxable income and severance has tax withheld.{' '}
        <Link href="/tools/severance-calculator" className={LINK}>See what a severance leaves after withholding</Link>.
      </p>
    </section>
  )
}
