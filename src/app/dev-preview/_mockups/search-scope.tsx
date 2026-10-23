'use client'

import { useState } from 'react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ScopeToggle } from '@/components/dashboard/ScopeToggle'
import { ExploreQuestionCard, ExploredOptionsList, PivotMessageCard } from '@/components/dashboard/PivotScopeCards'
import { JobWhyLine } from '@/components/jobs/JobCardParts'
import { pivotMessage } from '@/lib/journey/pivot-scope-message'
import { widenedFitNote, type ExploredOption, type SearchScope } from '@/lib/jobs/search-scope'

// The jobs page's scope switch, the once-only pivot message, the exploring question and the lower-fit lines, fed
// sample data (the real components, preview mode: no server calls). Dev-only.

const HOME = { functions: ['finance'], industries: ['financial services & banking'], states: ['CA'] }
const OPTIONS: ExploredOption[] = [
  { kind: 'function', value: 'Marketing', on: true, source: 'exploration', at: '' },
  { kind: 'industry', value: 'Healthcare & Hospital Systems', on: false, source: 'exploration', at: '' },
  { kind: 'place', value: 'NC', on: false, source: 'question', at: '' },
]
const JOBS = [
  { title: 'Finance Director', company: 'Harbor Credit Union', fn: 'finance', industry: 'Financial Services & Banking', state: 'CA', kind: null },
  { title: 'Marketing Operations Manager', company: 'Northline', fn: 'marketing', industry: 'Financial Services & Banking', state: 'CA', kind: 'function' as const },
  { title: 'Director of Finance', company: 'Bayview Health', fn: 'finance', industry: 'Healthcare & Hospital Systems', state: 'CA', kind: 'industry' as const },
  { title: 'Finance Director', company: 'Carolina Mutual', fn: 'finance', industry: 'Financial Services & Banking', state: 'NC', kind: 'place' as const },
]

function Page({ initial, withMessage, withQuestion }: { initial: SearchScope; withMessage: boolean; withQuestion: boolean }) {
  const [scope, setScope] = useState<SearchScope>(initial)
  const on = (o: ExploredOption) => scope === 'everything' || (scope === 'broader' && o.on)
  const active = scope === 'narrow' ? [] : OPTIONS.filter(on)
  const outside = {
    functions: active.filter((o) => o.kind === 'function').map((o) => o.value),
    industries: active.filter((o) => o.kind === 'industry').map((o) => o.value),
    places: active.filter((o) => o.kind === 'place').map((o) => o.value),
  }
  const shown = JOBS.filter((j) => j.kind === null || active.some((o) => o.kind === j.kind && (j.kind === 'function' ? o.value.toLowerCase() === j.fn : j.kind === 'industry' ? o.value === j.industry : o.value === j.state)))
  const msg = pivotMessage({ outside, homeFunction: 'Finance', keywords: ['budgeting', 'forecasting'] })
  return (
    <PreviewShell place="jobs" entry="find">
      <PageHeader title="Your best matches today" intro="Jobs ranked by how well they fit you, each with the reason." />
      <div className="space-y-3">
        <ScopeToggle surface="find_my_job" current={scope} preview onPreview={setScope} />
        {withMessage && scope !== 'narrow' && <PivotMessageCard message={msg} counts={{ functions: outside.functions.length, industries: outside.industries.length, places: outside.places.length }} preview />}
        {withQuestion && <ExploreQuestionCard question={{ kind: 'industry', value: 'Insurance', text: 'Are you exploring a move into Insurance?' }} preview />}
        <ExploredOptionsList options={OPTIONS} preview />
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
        {shown.map((j) => {
          const note = widenedFitNote({ functions: [j.fn], industry: j.industry, states: [j.state] }, outside, HOME)
          return (
            <li key={j.title + j.company} className="p-4">
              <span className="text-sm font-medium text-foreground">{j.title}</span> <span className="text-sm text-muted-foreground">at {j.company}</span>
              <JobWhyLine fits={note ? [] : ['Your field', 'In Financial Services & Banking']} gap={null} lowerFit={note} />
            </li>
          )
        })}
      </ul>
    </PreviewShell>
  )
}

export const ScopeBroaderFirst = () => <Page initial="broader" withMessage withQuestion={false} />
export const ScopeEverythingQuestion = () => <Page initial="everything" withMessage={false} withQuestion />
export const ScopeNarrow = () => <Page initial="narrow" withMessage={false} withQuestion={false} />
