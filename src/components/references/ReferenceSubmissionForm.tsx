'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RatingScale } from './RatingScale'
import { BARSRatingScale } from './BARSRatingScale'
import { ReferencePerformanceScale } from './ReferencePerformanceScale'
import { AnchoredOverallScale } from './AnchoredOverallScale'
import { cn } from '@/lib/utils'

interface DimensionGroup {
  dimension: string
  dimensionLabel: string
  anchors: { scalePoint: number; anchorText: string }[]
}

const PERFORMANCE_ITEMS: { dimension: string; items: { key: string; label: string }[] }[] = [
  {
    dimension: 'Execution',
    items: [
      { key: 'a1', label: 'Delivered what they committed to, on the timeline they set' },
      { key: 'a2', label: 'Quality of their work product' },
      { key: 'a3', label: 'Ability to run things without supervision' },
    ],
  },
  {
    dimension: 'Judgment',
    items: [
      { key: 'a4', label: "Decision quality when the answer wasn't obvious" },
      { key: 'a5', label: 'Knowing when to escalate versus decide' },
      { key: 'a6', label: 'Reading a situation correctly' },
    ],
  },
  {
    dimension: 'Composure',
    items: [
      { key: 'a7', label: 'Steadiness when things went wrong' },
      { key: 'a8', label: 'Response to hard feedback' },
      { key: 'a9', label: 'Their effect on the people around them under pressure' },
    ],
  },
  {
    dimension: 'Influence',
    items: [
      { key: 'a10', label: "Getting outcomes through people who didn't report to them" },
      { key: 'a11', label: 'Credibility with people more senior' },
      { key: 'a12', label: 'Willingness to say the unwelcome thing' },
    ],
  },
]

const TRAIT_ROWS = [
  { name: 'adaptability', label: 'Adaptability — how they handle change and ambiguity' },
  { name: 'followThrough', label: 'Follow-Through — reliability, does what they say' },
  { name: 'presence', label: 'Presence — how they show up with people, communication style' },
  { name: 'collaboration', label: 'Collaboration — team impact, how they make others better' },
  { name: 'composure', label: 'Composure — how they operate under pressure' },
]

export type ReferenceFormState = { error?: string } | undefined

interface FormPage {
  title: string
  fieldNames: string[]
  content: React.ReactNode
}

// The Prompt 48 mirrored-trait reference instrument — one question set,
// two entry points. `action` is pluggable (rather than hardcoding
// submitReference) specifically so the Prompt 65 employer-submitted flow
// can reuse this exact component/fields against its own server action
// instead of a second, duplicate form with the same questions.
//
// Paginated across several short pages (was one very long single-page
// form) — each page leads with quick click-through questions and ends with
// that page's one open-ended question, rather than dumping every written
// question at the bottom. Answers are captured into a ref as the referee
// fills them in (via a single delegated onChange on the <form>) so a page
// change can (a) echo every already-answered field back in as a hidden
// input — otherwise only the current page's fields would be present in the
// FormData at final submit — and (b) fire `onSaveDraft` so an abandoned,
// partway-done reference still leaves real answers behind.
export function ReferenceSubmissionForm({
  token,
  candidateName,
  dimensionGroups,
  action,
  hiddenFields,
  submitLabel = 'Submit reference',
  beforeContent,
  isManager = false,
  writtenQuestions,
  verification,
  initialAnswers,
  initialPage,
  onSaveDraft,
}: {
  token?: string
  candidateName: string
  dimensionGroups: DimensionGroup[]
  action: (state: ReferenceFormState, formData: FormData) => Promise<ReferenceFormState>
  hiddenFields?: Record<string, string>
  submitLabel?: string
  // Extra fields rendered inside the same <form>, before the reference
  // questions — the Prompt 65 employer flow uses this for the
  // employer/employee identification fields that have no equivalent in
  // the token-based referee flow (which already knows who's referring).
  beforeContent?: React.ReactNode
  // Part B's b1/b3 are manager-only in copy (worded differently for
  // non-managers, and b3 doesn't render at all for non-managers).
  isManager?: boolean
  // Part C — the two written questions assigned to this reference at
  // invite time (see written-question-pool.ts). Omitted entirely on
  // older/legacy links that predate this feature.
  writtenQuestions?: { key: string; text: string }[]
  // Part D — pre-filled from the candidate's own claim (sourced from the
  // linked WorkHistoryEntry, when the invite was tied to one job — see
  // workHistoryEntryId), for the reference to confirm or correct.
  verification?: {
    claimedTitle: string | null
    claimedCompany: string | null
    claimedBullet: string | null
    claimedYearsTogether: number | null
  }
  // Resume-in-progress support: a previously autosaved draft (see
  // saveReferenceDraft) and the page it was saved from. Omitted (or empty)
  // on a fresh, never-started reference.
  initialAnswers?: Record<string, string> | null
  initialPage?: number | null
  // Fired after each page's fields pass validation, before advancing —
  // omit to skip autosave entirely (the employer flow has no Reference row
  // to save a draft against until final submit).
  onSaveDraft?: (page: number, answers: Record<string, string>) => void
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const answersRef = useRef<Record<string, string>>(initialAnswers ?? {})
  const [page, setPage] = useState(() => initialPage ?? 0)
  // Mirrors answersRef, but as state — read during render (for the hidden
  // echo inputs below) so it must live in state, not the ref itself
  // (react-hooks/refs forbids reading ref.current during render). Updated
  // in lockstep with every page change via goToPage.
  const [answerSnapshot, setAnswerSnapshot] = useState<Record<string, string>>(initialAnswers ?? {})

  const verificationRows: {
    claimedTitle: boolean
    claimedCompany: boolean
    claimedBullet: boolean
    claimedYears: boolean
  } | null =
    verification &&
    (verification.claimedTitle ||
      verification.claimedCompany ||
      verification.claimedBullet ||
      verification.claimedYearsTogether != null)
      ? {
          claimedTitle: !!verification.claimedTitle,
          claimedCompany: !!verification.claimedCompany,
          claimedBullet: !!verification.claimedBullet,
          claimedYears: verification.claimedYearsTogether != null,
        }
      : null

  const performanceFieldNames = PERFORMANCE_ITEMS.flatMap((g) => g.items.map((i) => `perf-${i.key}`))
  const barsFieldNames = dimensionGroups.map((g) => `barsScore-${g.dimension}`)
  const traitFieldNames = TRAIT_ROWS.flatMap((t) => [`trait-${t.name}`, `traitExample-${t.name}`])
  const verificationFieldNames = verificationRows
    ? [
        ...(verificationRows.claimedTitle ? ['verifiedTitleCorrect', 'correctedTitle'] : []),
        ...(verificationRows.claimedCompany ? ['verifiedCompanyCorrect', 'correctedCompany'] : []),
        ...(verificationRows.claimedBullet ? ['verifiedBulletCorrect', 'correctedBullet'] : []),
        ...(verificationRows.claimedYears ? ['verifiedDatesCorrect', 'correctedDates'] : []),
        'verifiedReportingCorrect',
        'correctedReporting',
        'verifiedScopeCorrect',
        'correctedScope',
        'verificationConfidence',
      ]
    : []
  const writtenFieldNames = (writtenQuestions ?? []).map((_, i) => `writtenResponse${i + 1}`)

  const pages: FormPage[] = [
    {
      title: 'Performance',
      fieldNames: ['overallRating', ...performanceFieldNames, 'strengthSummary'],
      content: (
        <>
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              Most good people are a <strong className="text-foreground">2</strong>. A 2 means they
              did the job well — it&apos;s not a criticism. Please save{' '}
              <strong className="text-foreground">4</strong> for people you&apos;d describe as among
              the best you&apos;ve ever worked with. If everyone gets a 4, nobody can tell your
              strong people apart.
            </p>
          </div>
          <AnchoredOverallScale
            name="overallRating"
            label={`Overall, how would you rate working with ${candidateName}?`}
          />
          <div className="space-y-5">
            {PERFORMANCE_ITEMS.map((group) => (
              <div key={group.dimension} className="space-y-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.dimension}
                </h3>
                {group.items.map((item) => (
                  <ReferencePerformanceScale key={item.key} itemKey={item.key} label={item.label} />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="strengthSummary">What are they especially good at?</Label>
            <Textarea id="strengthSummary" name="strengthSummary" rows={3} required />
          </div>
        </>
      ),
    },
    {
      title: 'Working Style',
      fieldNames: [...barsFieldNames, 'growthAreaSummary'],
      content: (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            For each area below, pick the description that best matches how {candidateName}
            {' '}actually worked.
          </h2>
          {dimensionGroups.map((group) => (
            <BARSRatingScale
              key={group.dimension}
              dimension={group.dimension}
              dimensionLabel={group.dimensionLabel}
              anchors={group.anchors}
            />
          ))}
          <div className="space-y-2">
            <Label htmlFor="growthAreaSummary">Where could they grow? (optional)</Label>
            <Textarea id="growthAreaSummary" name="growthAreaSummary" rows={3} />
          </div>
        </>
      ),
    },
    {
      title: 'How They Compare',
      fieldNames: [
        'compRelativeRank',
        'compWouldHireAgain',
        ...(isManager ? ['compDepartureContext'] : []),
        'compWouldTakeAgain',
        'compTrustedScope',
        'wouldWorkWithAgainReason',
      ],
      content: (
        <>
          <RadioQuestion
            name="compRelativeRank"
            label={
              isManager
                ? `Of everyone who's held a comparable role under you, where does ${candidateName} rank?`
                : `Of everyone you've worked alongside at this level, where does ${candidateName} rank?`
            }
            options={[
              { value: 'BOTTOM_HALF', label: 'Bottom half' },
              { value: 'TOP_HALF', label: 'Top half' },
              { value: 'TOP_25', label: 'Top 25%' },
              { value: 'TOP_10', label: 'Top 10%' },
              { value: 'TOP_1', label: 'Top 1%' },
            ]}
          />
          <RadioQuestion
            name="compWouldHireAgain"
            label={`Would you hire ${candidateName} again?`}
            options={[
              { value: 'NO', label: 'No' },
              { value: 'PROBABLY_NOT', label: 'Probably not' },
              { value: 'PROBABLY', label: 'Probably' },
              { value: 'DEFINITELY', label: 'Definitely' },
            ]}
          />
          {isManager && (
            <RadioQuestion
              name="compDepartureContext"
              label={`When ${candidateName} left, what happened?`}
              options={[
                { value: 'INITIATED_BY_ME', label: 'I initiated it' },
                { value: 'RELIEVED', label: 'I was relieved' },
                { value: 'UNDERSTOOD_SUPPORTED', label: 'I understood and supported it' },
                { value: 'ASKED_TO_STAY', label: 'I asked them to stay' },
                { value: 'FOUGHT_TO_KEEP', label: 'I fought to keep them' },
              ]}
            />
          )}
          <RadioQuestion
            name="compWouldTakeAgain"
            label={`If you were starting something tomorrow and could take five people, would ${candidateName} be one?`}
            options={[
              { value: 'NO', label: 'No' },
              { value: 'MAYBE', label: 'Maybe, depending on the need' },
              { value: 'YES', label: 'Yes' },
              { value: 'YES_FIRST_CALL', label: 'Yes, first call' },
            ]}
          />
          <RadioQuestion
            name="compTrustedScope"
            label={`What's the biggest job you'd trust ${candidateName} with today?`}
            options={[
              { value: 'SAME', label: 'Same scope they had' },
              { value: 'SOMEWHAT_MORE', label: 'Somewhat more' },
              { value: 'MEANINGFULLY_MORE', label: 'Meaningfully more' },
              { value: 'STEP_CHANGE', label: "A step change beyond anything they've done" },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="wouldWorkWithAgainReason">Why (or why not)? (optional)</Label>
            <Textarea id="wouldWorkWithAgainReason" name="wouldWorkWithAgainReason" rows={2} />
          </div>
        </>
      ),
    },
    {
      title: 'A Few Traits',
      fieldNames: [...traitFieldNames, 'superpowerText'],
      content: (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            A few traits, one example each — these help paint a fuller picture than ratings alone.
          </h2>
          {TRAIT_ROWS.map((t) => (
            <TraitRow key={t.name} name={t.name} label={t.label} candidateName={candidateName} />
          ))}
          <div className="space-y-2">
            <Label htmlFor="superpowerText">
              What&apos;s their superpower — the thing they&apos;re better at than almost anyone
              you&apos;ve worked with? (optional)
            </Label>
            <Textarea id="superpowerText" name="superpowerText" rows={2} />
          </div>
        </>
      ),
    },
    ...(verificationRows
      ? [
          {
            title: 'One Last Check',
            fieldNames: [...verificationFieldNames, 'underPressureStory'],
            content: (
              <>
                {verificationRows.claimedTitle && (
                  <VerifyRow
                    label={`${candidateName} says their title was "${verification!.claimedTitle}" in this role. Correct?`}
                    correctName="verifiedTitleCorrect"
                    correctionName="correctedTitle"
                    correctionLabel="What should it say instead?"
                  />
                )}
                {verificationRows.claimedCompany && (
                  <VerifyRow
                    label={`They said this was at ${verification!.claimedCompany}. Correct?`}
                    correctName="verifiedCompanyCorrect"
                    correctionName="correctedCompany"
                    correctionLabel="What's the actual company?"
                  />
                )}
                {verificationRows.claimedBullet && (
                  <VerifyRow
                    label={`Their resume includes this from that role: "${verification!.claimedBullet}." Does that match what you saw them do?`}
                    correctName="verifiedBulletCorrect"
                    correctionName="correctedBullet"
                    correctionLabel="What's off about it?"
                  />
                )}
                {verificationRows.claimedYears && (
                  <VerifyRow
                    label={`They said you worked together for about ${verification!.claimedYearsTogether} year${verification!.claimedYearsTogether === 1 ? '' : 's'}. Does that match?`}
                    correctName="verifiedDatesCorrect"
                    correctionName="correctedDates"
                    correctionLabel="What's the actual timeframe?"
                  />
                )}
                <VerifyRow
                  label="Was the reporting relationship they described accurate?"
                  correctName="verifiedReportingCorrect"
                  correctionName="correctedReporting"
                  correctionLabel="What was the actual reporting relationship?"
                />
                <VerifyRow
                  label="Does the scope they described (team size, budget, etc.) match what you remember?"
                  correctName="verifiedScopeCorrect"
                  correctionName="correctedScope"
                  correctionLabel="What's different?"
                />
                <RatingScale
                  name="verificationConfidence"
                  label="How confident are you in these details, overall?"
                  lowLabel="Not very"
                  highLabel="Very"
                  points={[1, 2, 3, 4]}
                />
                <div className="space-y-2">
                  <Label htmlFor="underPressureStory">
                    Describe {candidateName}
                    {' '}under real pressure — a specific moment, not a generality. (optional)
                  </Label>
                  <Textarea id="underPressureStory" name="underPressureStory" rows={3} />
                </div>
              </>
            ),
          },
        ]
      : []),
    {
      title: 'In Your Own Words',
      fieldNames: [...writtenFieldNames, 'definingStory', 'contextNotes', 'quotableWithAttribution'],
      content: (
        <>
          {!verificationRows && (
            <div className="space-y-2">
              <Label htmlFor="underPressureStory">
                Describe {candidateName}
                {' '}under real pressure — a specific moment, not a generality. (optional)
              </Label>
              <Textarea id="underPressureStory" name="underPressureStory" rows={3} />
            </div>
          )}
          {writtenQuestions && writtenQuestions.length > 0 && (
            <div className="space-y-4">
              {writtenQuestions.map((q, i) => (
                <div key={q.key} className="space-y-2">
                  <Label htmlFor={`writtenResponse${i + 1}`}>{q.text}</Label>
                  <Textarea id={`writtenResponse${i + 1}`} name={`writtenResponse${i + 1}`} rows={3} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="definingStory">
              One story that shows who they are, not just what they did. (optional)
            </Label>
            <Textarea id="definingStory" name="definingStory" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contextNotes">Anything else worth knowing? (optional)</Label>
            <Textarea id="contextNotes" name="contextNotes" rows={2} />
          </div>
          <fieldset className="space-y-2 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Can we quote you by name?</legend>
            <p className="text-sm text-muted-foreground">
              {candidateName}
              {' '}will review and approve every quote before it&apos;s used — nothing is
              published automatically.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="quotableWithAttribution" value="yes" required /> Yes,
                quote me with my name and title
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="quotableWithAttribution" value="no" /> Keep this available
                on request only
              </label>
            </div>
          </fieldset>
        </>
      ),
    },
  ]

  // underPressureStory belongs to whichever of the two candidate pages
  // actually renders (verification page when present, otherwise folded
  // into the final page) — added above via conditional content, not listed
  // twice in fieldNames.
  if (!verificationRows) {
    pages[pages.length - 1].fieldNames = ['underPressureStory', ...pages[pages.length - 1].fieldNames]
  }

  const clampedPage = Math.min(Math.max(page, 0), pages.length - 1)
  const currentFieldNames = new Set(pages[clampedPage].fieldNames)
  const isLastPage = clampedPage === pages.length - 1

  // Prefill the current page's live fields from anything already captured
  // (a prior page visit this session, or a resumed draft) — done via a
  // direct DOM walk rather than threading defaultValue/defaultChecked
  // through every sub-component, since fields here are uncontrolled by
  // design (RatingScale, BARSRatingScale, etc. all manage their own state).
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]')) {
      if (el.type === 'hidden') continue
      const saved = answersRef.current[el.name]
      if (saved === undefined) continue
      if (el.type === 'radio') {
        ;(el as HTMLInputElement).checked = el.value === saved
      } else {
        el.value = saved
      }
    }
  }, [clampedPage])

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const target = e.target as unknown as HTMLInputElement | HTMLTextAreaElement
    if (!target.name || target.type === 'hidden') return
    if (target.type === 'radio' && !(target as HTMLInputElement).checked) return
    answersRef.current = { ...answersRef.current, [target.name]: target.value }
  }

  function goToPage(next: number) {
    setPage(next)
    setAnswerSnapshot({ ...answersRef.current })
    if (onSaveDraft) onSaveDraft(next, answersRef.current)
  }

  function handleNext() {
    if (!formRef.current?.reportValidity()) return
    goToPage(clampedPage + 1)
  }

  function handleBack() {
    goToPage(Math.max(0, clampedPage - 1))
  }

  const hiddenEchoes = Object.entries(answerSnapshot).filter(([name]) => !currentFieldNames.has(name))

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={handleFormChange}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      {token && <input type="hidden" name="token" value={token} />}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {hiddenEchoes.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {beforeContent}

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Page {clampedPage + 1} of {pages.length}
          </span>
          <span>{pages[clampedPage].title}</span>
        </div>
        <div className="flex gap-1">
          {pages.map((p, i) => (
            <div
              key={p.title}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i <= clampedPage ? 'bg-brand' : 'bg-border'
              )}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">{pages[clampedPage].content}</div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between gap-3">
        {clampedPage > 0 ? (
          <Button type="button" variant="outline" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {isLastPage ? (
          <Button type="submit" disabled={pending}>
            {pending ? 'Submitting…' : submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext}>
            Next
          </Button>
        )}
      </div>
    </form>
  )
}

// One of the five reference-only trait ratings (Prompt 48) — a 1-5 scale
// plus an optional one-example text, same shape for all five.
function TraitRow({ name, label, candidateName }: { name: string; label: string; candidateName: string }) {
  return (
    <div className="space-y-2">
      <RatingScale name={`trait-${name}`} label={label} lowLabel="Rarely" highLabel="Consistently" />
      <div className="space-y-1">
        <Label htmlFor={`trait-example-${name}`} className="text-sm font-normal text-muted-foreground">
          One example of {candidateName} showing this (optional)
        </Label>
        <Textarea id={`trait-example-${name}`} name={`traitExample-${name}`} rows={2} />
      </div>
    </div>
  )
}

// Part B comparative-standing question — a plain radio group, deliberately
// NOT styled with the anchored-scale equal-weight treatment (that rule is
// specific to Part A's performance ratings) since these are qualitatively
// distinct multi-choice options, not points on one intensity scale.
function RadioQuestion({
  name,
  label,
  options,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} value={opt.value} required />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Part D verification row — yes/no plus a conditionally-shown correction
// field. Uses a checkbox-toggled reveal (no JS) so this component can stay
// a plain server-rendered form field like everything else here.
function VerifyRow({
  label,
  correctName,
  correctionName,
  correctionLabel,
}: {
  label: string
  correctName: string
  correctionName: string
  correctionLabel: string
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <fieldset className="space-y-1.5">
        <legend className="text-sm text-foreground">{label}</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={correctName} value="yes" /> Correct
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={correctName} value="no" /> Not quite
          </label>
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={correctionName} className="text-xs font-normal text-muted-foreground">
          {correctionLabel} (leave blank if correct)
        </Label>
        <Textarea id={correctionName} name={correctionName} rows={1} />
      </div>
    </div>
  )
}
