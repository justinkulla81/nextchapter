import type {
  Grade,
  FactorType,
  MarketRealityDimension,
  SearchExecutionEngine,
} from '@/lib/scoring/grade'
import {
  GRADE_BAND_DESCRIPTION,
  FACTOR_TYPE_LABEL,
  FACTOR_TYPE_EXPLANATION,
  MARKET_REALITY_DIMENSION_LABEL,
  MARKET_REALITY_DIMENSION_FACTOR_TYPE,
  MARKET_REALITY_DIMENSION_EXPLANATION,
  SEARCH_EXECUTION_ENGINE_LABEL,
  SEARCH_EXECUTION_ENGINE_EXPLANATION,
} from '@/lib/scoring/grade'
import { TIER_UNLOCKS } from '@/lib/community/unlock-tier'
import { cn } from '@/lib/utils'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']
const FACTOR_TYPE_ORDER: FactorType[] = ['controllable', 'influenceable', 'structural']
const MARKET_REALITY_KEYS = Object.keys(
  MARKET_REALITY_DIMENSION_LABEL
) as MarketRealityDimension['key'][]
const SEARCH_EXECUTION_KEYS = Object.keys(
  SEARCH_EXECUTION_ENGINE_LABEL
) as SearchExecutionEngine['key'][]

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

export function GradeSystemExplainer() {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          How to read your grades
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
              <span className={cn('w-4 shrink-0 font-bold', GRADE_COLOR[g])}>{g}</span>
              <span className="text-muted-foreground">{GRADE_BAND_DESCRIPTION[g]}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          Controllable, influenceable, structural
        </h3>
        <p className="mt-2 text-muted-foreground">
          Some of what feeds Market Reality Grade is fully yours to move; some of it isn&apos;t. We label
          each one so a low grade doesn&apos;t read as a verdict on your effort when it&apos;s really
          a verdict on the market.
        </p>
        <div className="mt-3 space-y-2">
          {FACTOR_TYPE_ORDER.map((ft) => (
            <div key={ft}>
              <span className="font-medium text-foreground">{FACTOR_TYPE_LABEL[ft]}</span>
              <span className="text-muted-foreground"> — {FACTOR_TYPE_EXPLANATION[ft]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
            Market Reality dimensions
          </h3>
          <div className="mt-3 space-y-2">
            {MARKET_REALITY_KEYS.map((key) => (
              <div key={key}>
                <span className="font-medium text-foreground">
                  {MARKET_REALITY_DIMENSION_LABEL[key]}
                </span>{' '}
                <span className="text-xs text-muted-foreground">
                  ({FACTOR_TYPE_LABEL[MARKET_REALITY_DIMENSION_FACTOR_TYPE[key]]})
                </span>
                <p className="text-muted-foreground">{MARKET_REALITY_DIMENSION_EXPLANATION[key]}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
            Search Action engines
          </h3>
          <div className="mt-3 space-y-2">
            {SEARCH_EXECUTION_KEYS.map((key) => (
              <div key={key}>
                <span className="font-medium text-foreground">
                  {SEARCH_EXECUTION_ENGINE_LABEL[key]} Engine
                </span>
                <p className="text-muted-foreground">{SEARCH_EXECUTION_ENGINE_EXPLANATION[key]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
        <h3 className="text-xs font-semibold tracking-widest text-brand uppercase">
          How to earn an A in Search Action Grade
        </h3>
        <p className="mt-2 text-muted-foreground">
          Unlike Market Reality Grade, everyone can bring Search Action Grade to an A — it&apos;s
          entirely made of things you do: finishing your profile and assessment, completing your
          action-plan confirmations, running jobs through fit feedback, keeping a resume and work
          samples current, posting on LinkedIn, and following through on your weekly Search
          Sprints. There&apos;s no ceiling imposed by your background here.
        </p>
        <p className="mt-2 text-muted-foreground">
          Building it up unlocks real things as you go — reach Tier 5 and you&apos;re in the running
          for {TIER_UNLOCKS[5]}.
        </p>
        <p className="mt-2 text-muted-foreground">
          Starting Week 4, an A requires real work across all four engines — you can&apos;t max out
          your Search Action Grade by leaning on just one. If any engine falls behind, your grade is
          capped at B until it catches up.
        </p>
        <p className="mt-3 font-medium text-foreground">
          Not everyone who searches will land the role they want — that&apos;s the honest truth. But
          putting in the work meaningfully improves your odds, and Search Action Grade is the lever
          that&apos;s entirely in your hands. It&apos;s all about your Search Action Grade.
        </p>
      </div>
    </div>
  )
}
