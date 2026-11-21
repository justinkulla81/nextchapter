// Candidate › Home for a graduate of the last five years (owner, 2026-11-21: career help for every graduate, five years
// out). Their check-ins as a timeline (done, sent, coming), who their advisor is, and when the five years end. It takes
// the place of the stage panel for them: the timeline is their next step.

import { Check, Circle, Mail } from 'lucide-react'

export type FiveYearStep = { label: string; when: string; state: 'done' | 'answered' | 'sent' | 'past' | 'coming'; detail: string }

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 15))

/** Pure: the steps from a class year and the check-ins on record. Exported for tests and the dev preview. */
export function fiveYearSteps(classYear: number, checkIns: { kind: string; status: string }[], annualMonth: number, now = new Date()): FiveYearStep[] {
  const grad = new Date(Date.UTC(classYear, 4, 15))
  const status = (kind: string, due: Date): FiveYearStep['state'] => {
    const c = checkIns.find((x) => x.kind === kind)
    if (c?.status === 'RESPONDED') return 'answered'
    if (c?.status === 'SENT') return 'sent'
    return due <= now ? 'past' : 'coming'
  }
  const at = (n: number) => addMonths(grad, n)
  return [
    { label: 'Graduation', when: MONTH.format(grad), state: grad <= now ? 'done' : 'coming', detail: 'A read on your job market and a plan for your first search.' },
    { label: '6 months out', when: MONTH.format(at(6)), state: status('M6', at(6)), detail: 'A check-in: landed, or still looking? Looking goes to an advisor.' },
    { label: '18 months out', when: MONTH.format(at(18)), state: status('M18', at(18)), detail: 'Often a first job change: alumni at the companies hiring.' },
    { label: '2 years out', when: MONTH.format(at(24)), state: status('M24', at(24)), detail: 'Grad school or a first promotion: the program for your gap.' },
    {
      label: 'Years 3 to 5',
      when: `Each ${new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, annualMonth - 1, 1)))}`,
      state: at(60) <= now ? 'done' : 'coming',
      detail: 'One check-in a year, and career help whenever you ask.',
    },
  ]
}

const ICON = {
  done: <Check className="size-4 text-success" aria-hidden="true" />,
  answered: <Check className="size-4 text-success" aria-hidden="true" />,
  sent: <Mail className="size-4 text-primary" aria-hidden="true" />,
  past: <Circle className="size-4 text-muted-foreground" aria-hidden="true" />,
  coming: <Circle className="size-4 text-muted-foreground" aria-hidden="true" />,
}
const STATE: Record<FiveYearStep['state'], string> = { done: 'Done', answered: 'You answered', sent: 'In your inbox', past: 'Past', coming: 'Coming' }

export function FirstFiveYearsView({ college, steps, endsYear, helper }: { college: string; steps: FiveYearStep[]; endsYear: number; helper: string }) {
  return (
    <section aria-labelledby="five-h" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="five-h" className="text-base font-semibold">
          Your first five years with {college}
        </h2>
        <p className="text-sm text-muted-foreground">
          Career help through {endsYear}. {helper}
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3">
            <span className="mt-0.5">{ICON[s.state]}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {s.label} <span className="font-normal text-muted-foreground">· {s.when} · {STATE[s.state]}</span>
              </p>
              <p className="text-sm text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
