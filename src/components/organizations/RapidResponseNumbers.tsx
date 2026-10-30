import Link from 'next/link'
import { AudienceSection } from '@/components/organizations/AudienceShell'
import { getLayoffTracker } from '@/lib/warn/public-tracker'

/**
 * The layoffs we track, as three live counts for https://launchyournextchapter.com/for-rapid-response. Read from the
 * same tracker as https://launchyournextchapter.com/layoffs, which returns null instead of throwing: if it fails the
 * section is not rendered and the page loses nothing else.
 */
export async function RapidResponseNumbers() {
  const data = await getLayoffTracker(1)
  if (!data) return null
  const tiles = [
    { value: data.total.notices.toLocaleString(), label: 'layoffs tracked', detail: `From ${data.total.states} states, since ${data.total.since}.` },
    { value: data.year.layoffs.toLocaleString(), label: `layoffs filed or reported in ${data.year.year}`, detail: `${data.year.workers.toLocaleString()} workers named in them.` },
    { value: data.last30.notices.toLocaleString(), label: 'new layoffs in the last 30 days', detail: `${data.last30.workers.toLocaleString()} workers, in ${data.last30.states} states.` },
  ]
  return (
    <AudienceSection id="by-the-numbers" title="The layoffs we track right now">
      <ul className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-2xl bg-muted/40 p-5">
            <p className="font-display text-3xl font-semibold tracking-tight text-ink">{t.value}</p>
            <p className="mt-1 font-semibold text-ink">{t.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        <span className="font-semibold text-ink">How we count:</span> layoff and plant-closing notices filed under the WARN Act with state labor
        departments, plus layoffs reported elsewhere where no filing exists. Updated daily. See every one on{' '}
        <Link href="/layoffs" className="underline underline-offset-4">
          the layoff tracker
        </Link>
        .
      </p>
    </AudienceSection>
  )
}
