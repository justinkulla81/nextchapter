import type { Grade, CategoryKey } from '@/lib/scoring/grade'
import {
  GRADE_BAND_DESCRIPTION,
  GRADE_TEXT_COLOR,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  CATEGORY_EXPLANATION,
  WEEKLY_ENGINE_LABEL,
  WEEKLY_ENGINE_EXPLANATION,
} from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']
const WEEKLY_ENGINE_KEYS = Object.keys(WEEKLY_ENGINE_LABEL) as (keyof typeof WEEKLY_ENGINE_LABEL)[]

export function GradeSystemExplainer() {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          How to read your grade
        </h3>
        <p className="mt-2 text-muted-foreground">
          Every grade here is a letter — A through F — never a raw number. A number like
          &ldquo;72/100&rdquo; implies a precision the underlying signals don&apos;t actually have.
          The letter, plus the description below, is the whole story.
        </p>
        <p className="mt-2 text-muted-foreground">
          We&apos;re hard graders on purpose. Most candidates land on C — that&apos;s the honest,
          expected result, not a failure: it means you have real things going for you, but they
          aren&apos;t yet coming together into a search that&apos;s working. B is a genuine
          strength. A is rare, reserved for candidates where almost everything is already lined
          up. D means something is actively holding you back. F marks a real, major gap or
          missing piece, not just an average result.
        </p>
        <div className="mt-3 space-y-1.5">
          {GRADE_ORDER.map((g) => (
            <div key={g} className="flex items-baseline gap-2">
              <span className={cn('w-4 shrink-0 font-bold', GRADE_TEXT_COLOR[g])}>{g}</span>
              <span className="text-muted-foreground">{GRADE_BAND_DESCRIPTION[g]}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          One grade, six categories
        </h3>
        <p className="mt-2 text-muted-foreground">
          Your Market Reality Grade is one number, built from six categories — a stable baseline
          that only moves when something real changes (a reference lands, an interview happens, a
          title changes), plus how this week&apos;s effort is going. Nothing here is scored on your
          How I Work Best results directly — those describe your style, not a right or wrong way to
          work, and stay separate from any grade.
        </p>
        <div className="mt-3 space-y-2">
          {(CATEGORY_ORDER as CategoryKey[]).map((key) => (
            <div key={key}>
              <span className="font-medium text-foreground">{CATEGORY_LABEL[key]}</span>
              <p className="text-muted-foreground">{CATEGORY_EXPLANATION[key]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          Weekly effort — the lever that&apos;s entirely in your hands
        </h3>
        <p className="mt-2 text-muted-foreground">
          Each week, your Networking, Learning, and Working actions nudge your grade — a strong
          week moves it up, a slow week moves it down, but neither one resets your baseline. A
          consistent, real effort over time is what closes the gap on the categories above.
        </p>
        <div className="mt-3 space-y-2">
          {WEEKLY_ENGINE_KEYS.filter((key) => key !== 'effort').map((key) => (
            <div key={key}>
              <span className="font-medium text-foreground">{WEEKLY_ENGINE_LABEL[key]}</span>
              <p className="text-muted-foreground">{WEEKLY_ENGINE_EXPLANATION[key]}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 font-medium text-foreground">
          Not everyone who searches will land the role they want — that&apos;s the honest truth. But
          doing this work helps two ways at once: it improves your grade, and it&apos;s genuinely
          helping your search whether or not it&apos;s being graded — networking, learning, and
          putting yourself out there all matter on their own.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          What an A means
        </h3>
        <p className="mt-2 text-muted-foreground">
          An A isn&apos;t just a badge — it&apos;s our own read that we&apos;re ready to unabashedly
          support and market you as an excellent candidate. That&apos;s why it unlocks recruiter
          visibility, the job board, and the executive recruiter database: we&apos;re vouching for
          you at that point, not just rewarding activity.
        </p>
      </div>
    </div>
  )
}
