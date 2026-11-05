import { SeoPage, H2 } from '@/components/seo/SeoPage'
import { Squiggle } from '@/components/ui/squiggle'
import { Highlight } from '@/components/ui/highlight'
import { ShortVersion } from '@/components/ui/short-version'
import { PaperNote } from '@/components/ui/paper-note'
import { BookmarkMark } from '@/components/ui/bookmark-mark'

// Phase 1 (the building blocks) and phase 2 (a public page with them), with sample data. Not reachable in production.
// Phase 2 is the real SeoPage frame with `squiggle` on, so the next-step box is the page's one ask.
export const dynamic = 'force-dynamic'

const ROWS = [
  { name: 'Example Bank', state: 'New York', workers: 1200 },
  { name: 'Example Media Co', state: 'California', workers: 640 },
  { name: 'Example Software Inc', state: 'Washington', workers: 410 },
]

function Tile({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-light-gray bg-white p-5">
      <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{name}</span>
      {children}
    </div>
  )
}

export default function DesignElementsPreview() {
  return (
    <>
      <main className="mx-auto max-w-4xl space-y-6 bg-off-white p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Phase 1: the building blocks</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sample data. Phase 2 starts below the line. Blue squiggle and a pale marker, because on the site orange is the action colour.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile name="Squiggle">
            <div>
              <p className="font-display text-2xl font-bold text-navy">Your week</p>
              <Squiggle className="mt-1" />
            </div>
          </Tile>
          <Tile name="Highlight">
            <p className="text-lg text-ink">Companies named <Highlight>9,480 workers</Highlight> this week.</p>
          </Tile>
          <Tile name="ShortVersion">
            <ShortVersion>212 notices in 31 states. Finance led.</ShortVersion>
          </Tile>
          <Tile name="PaperNote">
            <PaperNote label="Today's note" name="Vic">One small thing is enough today.</PaperNote>
          </Tile>
          <Tile name="BookmarkMark">
            <div className="flex items-center gap-2 text-lg font-bold text-navy"><BookmarkMark /> NextChapter</div>
          </Tile>
          <Tile name="Colour tokens">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="size-8 rounded-md border border-paper-edge bg-paper" /> paper
              <span className="size-8 rounded-md bg-marker" /> marker
              <span className="size-8 rounded-md bg-action" /> action (unchanged)
            </div>
          </Tile>
        </div>
        <h1 className="border-t border-light-gray pt-8 text-2xl font-semibold tracking-tight text-navy">Phase 2: a public page</h1>
      </main>
      <SeoPage
        squiggle
        trail={[{ name: 'Layoffs', path: '/layoffs' }, { name: 'This week', path: '/layoffs/this-week' }]}
        h1="Layoffs this week: 212 notices in 31 states"
        lede="Public WARN notices filed in the last seven days, with the employer, the state and the number of workers."
      >
        <ShortVersion className="mt-6">
          Companies named <Highlight>9,480 workers</Highlight> in public WARN notices. Finance and media cut the most; three metros added more white-collar roles than they cut.
        </ShortVersion>
        <h2 className={`mt-8 mb-3 ${H2}`}>The largest notices</h2>
        <div className="overflow-x-auto rounded-2xl border border-light-gray bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-light-gray text-xs tracking-widest text-muted-foreground uppercase">
                <th className="px-4 py-3 font-semibold">Employer</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 text-right font-semibold">Workers</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name} className="border-b border-light-gray/60 last:border-0">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.state}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.workers.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeoPage>
    </>
  )
}
