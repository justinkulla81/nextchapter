'use client'

import { useActionState, useState } from 'react'
import { answerRedFlags, type RedFlagsState } from '@/app/dashboard/complete-profile/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import type { CurrentJobStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { FromResumeTag } from '@/components/dashboard/FromResumeTag'
import { CLEARANCE_HELD_OPTIONS, LICENSE_KEYS, LICENSE_LABEL, POLYGRAPH_HELD_OPTIONS } from '@/lib/jobs/requirements'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const PET_FRIENDLY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No / Indifferent' },
] as const

const yesNo = (v: boolean | null | undefined) => (v === true ? 'yes' : v === false ? 'no' : '')

/** What the member already answered, so editing (or adding the newer questions) never blanks an answer. */
export interface RedFlagsInitial {
  firedForCause: boolean | null
  hasRestrictiveCovenant: boolean | null
  restrictiveCovenantDetails: string | null
  willingToTakeBackgroundCheck: boolean | null
  willingToTakeDrugTest: boolean | null
  wantsAnimalFriendlyWorkplace: boolean | null
  clearanceLevel: string | null
  clearanceActive: boolean | null
  clearancePolygraph: string | null
  licensesHeld: string[]
  licensesAnsweredAt: Date | null
}

const CLEARANCE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'lapsed', label: 'Lapsed' },
] as const

export function RedFlagsQuestionsForm({
  currentJobStatus,
  initial,
  prefilled = [],
}: {
  currentJobStatus: CurrentJobStatus | null
  initial?: RedFlagsInitial
  /** Fields filled from the résumé and not confirmed yet (resume-prefill.ts). */
  prefilled?: string[]
}) {
  const [state, formAction, pending] = useActionState<RedFlagsState, FormData>(answerRedFlags, undefined)
  const [firedForCause, setFiredForCause] = useState(yesNo(initial?.firedForCause))
  const [restrictiveCovenant, setRestrictiveCovenant] = useState(yesNo(initial?.hasRestrictiveCovenant))
  const [backgroundCheck, setBackgroundCheck] = useState(yesNo(initial?.willingToTakeBackgroundCheck))
  const [drugTest, setDrugTest] = useState(yesNo(initial?.willingToTakeDrugTest))
  const [animalFriendly, setAnimalFriendly] = useState(yesNo(initial?.wantsAnimalFriendlyWorkplace))
  // Optional: matched against job requirements (requirements.ts). Blank = not asked yet.
  const [clearance, setClearance] = useState(initial?.clearanceLevel ?? '')
  const [clearanceStatus, setClearanceStatus] = useState(
    initial?.clearanceActive === true ? 'active' : initial?.clearanceActive === false ? 'lapsed' : ''
  )
  const [polygraph, setPolygraph] = useState(initial?.clearancePolygraph ?? '')
  const [licenses, setLicenses] = useState<string[]>(initial?.licensesHeld ?? [])
  const [noLicenses, setNoLicenses] = useState(!!initial?.licensesAnsweredAt && (initial?.licensesHeld ?? []).length === 0)
  const holdsClearance = clearance !== '' && clearance !== 'none'

  const askFiredForCause = currentJobStatus === 'LAID_OFF'

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      {askFiredForCause && (
        <div className="space-y-2">
          <Label>Were you let go for cause, rather than a no-fault layoff?</Label>
          <ChoiceButtons
            name="firedForCause"
            options={YES_NO_OPTIONS}
            value={firedForCause || null}
            onChange={setFiredForCause}
            columns={2}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>
          Do you have a non-compete, non-solicit, or other restrictive covenant that could affect your next role?
        </Label>
        <ChoiceButtons
          name="hasRestrictiveCovenant"
          options={YES_NO_OPTIONS}
          value={restrictiveCovenant || null}
          onChange={setRestrictiveCovenant}
          columns={2}
        />
        {restrictiveCovenant === 'yes' && (
          <Textarea
            name="restrictiveCovenantDetails"
            placeholder="What kind, and for how long?"
            defaultValue={initial?.restrictiveCovenantDetails ?? ''}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Are you willing to undergo a background check if an employer requires one?</Label>
        <ChoiceButtons
          name="willingToTakeBackgroundCheck"
          options={YES_NO_OPTIONS}
          value={backgroundCheck || null}
          onChange={setBackgroundCheck}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Are you willing to take a drug test if an employer requires one?</Label>
        <ChoiceButtons
          name="willingToTakeDrugTest"
          options={YES_NO_OPTIONS}
          value={drugTest || null}
          onChange={setDrugTest}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Do you want to work somewhere that&apos;s animal/pet-friendly?</Label>
        <ChoiceButtons
          name="wantsAnimalFriendlyWorkplace"
          options={PET_FRIENDLY_OPTIONS}
          value={animalFriendly || null}
          onChange={setAnimalFriendly}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>
          Do you hold a US security clearance? <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Some jobs require an active clearance. We use this to flag them for you and to show cleared roles.
        </p>
        <FromResumeTag show={prefilled.includes('clearanceLevel')} section="clearance" fields={['clearanceLevel']} submits={false} />
        <ChoiceButtons name="clearanceLevel" options={CLEARANCE_HELD_OPTIONS} value={clearance || null} onChange={setClearance} columns={5} responsive compact />
        {holdsClearance && (
          <>
            <ChoiceButtons
              name="clearanceStatus"
              options={CLEARANCE_STATUS_OPTIONS}
              value={(clearanceStatus || null) as 'active' | 'lapsed' | null}
              onChange={setClearanceStatus}
              columns={2}
            />
            <ChoiceButtons name="clearancePolygraph" options={POLYGRAPH_HELD_OPTIONS} value={polygraph || null} onChange={setPolygraph} columns={3} responsive compact />
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Which of these licenses do you hold? <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <FromResumeTag show={prefilled.includes('licensesHeld')} section="licenses" fields={['licensesHeld']} submits={false} />
        <div role="group" aria-label="Licenses held" className="flex flex-wrap gap-2">
          {LICENSE_KEYS.map((k) => {
            const on = licenses.includes(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setNoLicenses(false)
                  setLicenses((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))
                }}
                className={cn(
                  'rounded-lg border-2 px-3 py-1.5 text-sm font-medium',
                  on ? 'border-brand bg-brand/5 text-brand' : 'border-border bg-white text-foreground hover:border-brand/40'
                )}
              >
                {LICENSE_LABEL[k]}
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={noLicenses}
            onClick={() => {
              setNoLicenses(!noLicenses)
              setLicenses([])
            }}
            className={cn(
              'rounded-lg border-2 px-3 py-1.5 text-sm font-medium',
              noLicenses ? 'border-brand bg-brand/5 text-brand' : 'border-border bg-white text-foreground hover:border-brand/40'
            )}
          >
            None of these
          </button>
        </div>
        {licenses.map((k) => (
          <input key={k} type="hidden" name="licensesHeld" value={k} />
        ))}
        <input type="hidden" name="licensesAnswered" value={noLicenses || licenses.length > 0 ? '1' : ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save answers'}
      </Button>
    </form>
  )
}
