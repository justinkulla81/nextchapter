import { TrackedLink } from '@/components/marketing/TrackedLink'
import { LAYOFF_DATA_CITATION, LAYOFF_DATA_LICENSE, LAYOFF_DATA_LICENSE_URL } from '@/lib/data/layoff-export'
import { SITE_URL } from '@/lib/seo/facts'

// "Cite this data": the exact citation, the license and the file, on every page that states a layoff figure, so the people who
// quote the number (reporters, bloggers, researchers) have the one line to paste and a reason to link back.
export function CiteThisData({ path, asOf, source, csvHref = '/data/layoffs.csv' }: { path: string; asOf?: string | null; source: string; csvHref?: string }) {
  const citation = `${LAYOFF_DATA_CITATION.replace(/ launchyournextchapter\.com\/layoffs$/, '')} ${SITE_URL}${path}${asOf ? `. Data as of ${asOf}.` : '.'}`
  return (
    <section aria-labelledby="cite-this" className="mt-12 rounded-xl border border-border bg-white p-6">
      <h2 id="cite-this" className="text-xl font-semibold tracking-tight text-navy">Cite this data</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Free to quote and reuse under <a href={LAYOFF_DATA_LICENSE_URL} className="text-brand underline underline-offset-4" rel="noopener">{LAYOFF_DATA_LICENSE}</a> with a link back. Copy this line:
      </p>
      <p className="mt-3 select-all rounded-lg bg-off-white p-3 text-sm text-navy">{citation}</p>
      <p className="mt-3 text-sm">
        <TrackedLink href={csvHref} event="layoff_csv_downloaded" properties={{ source, path }} className="font-medium text-brand underline underline-offset-4">
          Download the CSV
        </TrackedLink>
        <span className="text-muted-foreground"> · one row per filing, with the state’s own source link.</span>
      </p>
    </section>
  )
}
