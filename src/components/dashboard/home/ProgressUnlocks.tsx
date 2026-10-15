import Link from 'next/link'
import { Check } from 'lucide-react'
import { HomeModule } from './HomeModule'
import type { Rung } from '@/lib/unlocks/ladder'
import type { DossierRequirement } from '@/lib/scoring/dossier-unlock'

// The Progress view: what the member's effort has built so far (their dossier
// evidence) and the whole unlock ladder in one order. No points, no badge wall.
export function ProgressUnlocks({ ladder, requirements }: { ladder: Rung[]; requirements: DossierRequirement[] }) {
  return (
    <div className="space-y-6">
      <HomeModule title="Your dossier is building">
        <p className="text-sm text-muted-foreground">
          Recruiters care about how you work, and a résumé cannot show it. Everything you do here becomes proof they can see once you choose to share it.
        </p>
        <ul className="space-y-2">
          {requirements.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={r.met ? 'grid size-5 place-items-center rounded-full bg-success text-white' : 'size-5 rounded-full border-2 border-border'}
                >
                  {r.met ? <Check className="size-3" /> : null}
                </span>
                <span className={r.met ? 'text-muted-foreground' : 'font-medium'}>{r.label}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.met ? 'Done' : `${r.current} of ${r.target}`}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/recruiter-report" className="inline-block text-sm font-medium text-brand underline underline-offset-4">
          Strengthen what recruiters see
        </Link>
      </HomeModule>

      <HomeModule title="Your unlocks">
        <ol className="space-y-4">
          {ladder.map((r) => (
            <li key={r.key} className="flex gap-3">
              <span
                aria-hidden
                className={
                  r.state === 'open'
                    ? 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-white'
                    : r.state === 'next'
                      ? 'mt-0.5 size-5 shrink-0 rounded-full border-2 border-orange'
                      : 'mt-0.5 size-5 shrink-0 rounded-full border-2 border-border'
                }
              >
                {r.state === 'open' ? <Check className="size-3" /> : null}
              </span>
              <div className="text-sm">
                <p className="font-semibold">
                  {r.label}
                  {r.state === 'open' && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Open</span>}
                  {r.state === 'next' && <span className="ml-2 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-foreground">Next</span>}
                </p>
                <p className="text-muted-foreground">
                  {r.state === 'open' ? `Opens: ${r.opens.join(', ')}.` : r.needs.length ? `You need ${r.needs.join(', ')}.` : ''}
                  {r.state === 'next' ? ` Opens: ${r.opens.join(', ')}.` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </HomeModule>
    </div>
  )
}
