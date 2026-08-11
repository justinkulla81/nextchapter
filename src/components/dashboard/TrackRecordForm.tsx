'use client'

import { useActionState, useState } from 'react'
import { updateTrackRecord } from '@/app/dashboard/track-record/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { MultiChoiceButtons } from '@/components/onboarding/MultiChoiceButtons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TrackRecordResponse } from '@prisma/client'
import {
  TRACK_RECORD_SIZE_BAND_LABELS,
  TRACK_RECORD_SIZE_BAND_ORDER,
  TRACK_RECORD_DOLLAR_BAND_LABELS,
  TRACK_RECORD_DOLLAR_BAND_ORDER,
  TRACK_RECORD_TENURE_BAND_LABELS,
  TRACK_RECORD_TENURE_BAND_ORDER,
  TRACK_RECORD_BOARD_EXPOSURE_LABELS,
  TRACK_RECORD_PNL_LABELS,
  TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS,
  TRACK_RECORD_REPORTED_TO_LABELS,
  APPROVAL_AUTHORITY_OPTIONS,
  OPERATING_SITUATION_OPTIONS,
  CROSS_FUNCTIONAL_AREA_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
  COMPANY_STAGE_HISTORY_OPTIONS,
  MANDATE_CLARITY_LABELS,
  DROVE_OUTCOMES_LABELS,
} from '@/lib/constants/track-record'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

function scaleOptions(labels: readonly string[]) {
  return labels.map((label, i) => ({ value: String(i + 1), label }))
}

function BandSelect<T extends string>({
  name,
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  name: string
  value: T
  onChange: (value: T) => void
  options: readonly T[]
  labels: Record<T, string>
  placeholder: string
}) {
  return (
    <Select name={name} value={value} onValueChange={(v) => onChange((v as T) ?? value)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {(v: string | null) => (v ? labels[v as T] : placeholder)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {labels[opt]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TrackRecordForm({
  response,
  isPeopleManager: initialIsPeopleManager,
}: {
  response: TrackRecordResponse | null
  isPeopleManager: boolean | null
}) {
  const [state, formAction, pending] = useActionState(updateTrackRecord, undefined)

  const [largestTeamManaged, setLargestTeamManaged] = useState(response?.largestTeamManaged ?? 'NONE')
  const [largestOrgIndirect, setLargestOrgIndirect] = useState(response?.largestOrgIndirect ?? 'NONE')
  const [budgetOwned, setBudgetOwned] = useState(response?.budgetOwned ?? 'NONE')
  const [approvalAuthority, setApprovalAuthority] = useState<string[]>(response?.approvalAuthority ?? [])
  const [situationRanking, setSituationRanking] = useState<string[]>(response?.situationRanking ?? [])
  const [mandateClarity, setMandateClarity] = useState<string | null>(
    response?.mandateClarity ? String(response.mandateClarity) : null
  )
  const [functionsOwnedOutsideCore, setFunctionsOwnedOutsideCore] = useState<string[]>(
    response?.functionsOwnedOutsideCore ?? []
  )
  const [droveOutcomesThroughOthers, setDroveOutcomesThroughOthers] = useState<string | null>(
    response?.droveOutcomesThroughOthers ? String(response.droveOutcomesThroughOthers) : null
  )
  const [peopleHiredDirectly, setPeopleHiredDirectly] = useState(response?.peopleHiredDirectly ?? 'NONE')
  const [ledThroughRestructuring, setLedThroughRestructuring] = useState<boolean | null>(
    response?.ledThroughRestructuring ?? null
  )
  const [sectorHistory, setSectorHistory] = useState<string[]>(response?.sectorHistory ?? [])
  const [stageHistory, setStageHistory] = useState<string[]>(response?.stageHistory ?? [])
  const [boardExposure, setBoardExposure] = useState(response?.boardExposure ?? 'NONE')
  const [largestInitiativeScope, setLargestInitiativeScope] = useState(response?.largestInitiativeScope ?? 'NONE')
  const [longestTenure, setLongestTenure] = useState(response?.longestTenure ?? 'UNDER_ONE_YEAR')
  const [isPeopleManager, setIsPeopleManager] = useState<boolean | null>(initialIsPeopleManager)
  const [pnlAccountability, setPnlAccountability] = useState(response?.pnlAccountability ?? 'NEITHER')
  const [geographicScope, setGeographicScope] = useState(response?.geographicScope ?? 'SINGLE_SITE')
  const [reportedToLevel, setReportedToLevel] = useState(response?.reportedToLevel ?? 'MANAGER')

  const situationLabelById = Object.fromEntries(OPERATING_SITUATION_OPTIONS.map((o) => [o.value, o.label]))

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label>Largest team you&apos;ve managed directly</Label>
        <BandSelect
          name="largestTeamManaged"
          value={largestTeamManaged}
          onChange={setLargestTeamManaged}
          options={TRACK_RECORD_SIZE_BAND_ORDER}
          labels={TRACK_RECORD_SIZE_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Largest organization you&apos;ve influenced indirectly (dotted-line, cross-functional)</Label>
        <BandSelect
          name="largestOrgIndirect"
          value={largestOrgIndirect}
          onChange={setLargestOrgIndirect}
          options={TRACK_RECORD_SIZE_BAND_ORDER}
          labels={TRACK_RECORD_SIZE_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Largest budget you&apos;ve owned</Label>
        <BandSelect
          name="budgetOwned"
          value={budgetOwned}
          onChange={setBudgetOwned}
          options={TRACK_RECORD_DOLLAR_BAND_ORDER}
          labels={TRACK_RECORD_DOLLAR_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Which of these could you approve without escalating?</Label>
        <MultiChoiceButtons
          name="approvalAuthority"
          options={APPROVAL_AUTHORITY_OPTIONS}
          value={approvalAuthority}
          onChange={setApprovalAuthority}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Rank these by how often you&apos;ve operated this way — click most frequent first</Label>
        <MultiChoiceButtons
          name="situationRanking"
          options={OPERATING_SITUATION_OPTIONS}
          value={situationRanking}
          onChange={setSituationRanking}
          columns={2}
          max={4}
        />
        {situationRanking.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Your order: {situationRanking.map((v) => situationLabelById[v]).join(' → ')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>When you&apos;ve stepped into a new role, how clear was your mandate?</Label>
        <ChoiceButtons
          name="mandateClarity"
          options={scaleOptions(MANDATE_CLARITY_LABELS)}
          value={mandateClarity}
          onChange={setMandateClarity}
          columns={2}
          responsive
        />
      </div>

      <div className="space-y-2">
        <Label>Which functions have you owned outside your core discipline?</Label>
        <MultiChoiceButtons
          name="functionsOwnedOutsideCore"
          options={CROSS_FUNCTIONAL_AREA_OPTIONS}
          value={functionsOwnedOutsideCore}
          onChange={setFunctionsOwnedOutsideCore}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>How often has your impact come through directing other people&apos;s work, rather than your own?</Label>
        <ChoiceButtons
          name="droveOutcomesThroughOthers"
          options={scaleOptions(DROVE_OUTCOMES_LABELS)}
          value={droveOutcomesThroughOthers}
          onChange={setDroveOutcomesThroughOthers}
          columns={2}
          responsive
        />
      </div>

      <div className="space-y-2">
        <Label>How many people have you hired directly?</Label>
        <BandSelect
          name="peopleHiredDirectly"
          value={peopleHiredDirectly}
          onChange={setPeopleHiredDirectly}
          options={TRACK_RECORD_SIZE_BAND_ORDER}
          labels={TRACK_RECORD_SIZE_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Have you led a team through a layoff, restructuring, or significant downsizing?</Label>
        <ChoiceButtons
          name="ledThroughRestructuring"
          options={YES_NO_OPTIONS}
          value={ledThroughRestructuring === null ? null : ledThroughRestructuring ? 'yes' : 'no'}
          onChange={(value) => setLedThroughRestructuring(value === 'yes')}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Which sectors have you worked in?</Label>
        <MultiChoiceButtons
          name="sectorHistory"
          options={INDUSTRY_SECTOR_OPTIONS}
          value={sectorHistory}
          onChange={setSectorHistory}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Which company stages have you worked in?</Label>
        <MultiChoiceButtons
          name="stageHistory"
          options={COMPANY_STAGE_HISTORY_OPTIONS}
          value={stageHistory}
          onChange={setStageHistory}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Board exposure</Label>
        <ChoiceButtons
          name="boardExposure"
          options={(Object.keys(TRACK_RECORD_BOARD_EXPOSURE_LABELS) as (keyof typeof TRACK_RECORD_BOARD_EXPOSURE_LABELS)[]).map(
            (value) => ({ value, label: TRACK_RECORD_BOARD_EXPOSURE_LABELS[value] })
          )}
          value={boardExposure}
          onChange={setBoardExposure}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Largest single initiative you&apos;ve owned, by dollar impact</Label>
        <BandSelect
          name="largestInitiativeScope"
          value={largestInitiativeScope}
          onChange={setLargestInitiativeScope}
          options={TRACK_RECORD_DOLLAR_BAND_ORDER}
          labels={TRACK_RECORD_DOLLAR_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Longest you&apos;ve stayed in one role</Label>
        <BandSelect
          name="longestTenure"
          value={longestTenure}
          onChange={setLongestTenure}
          options={TRACK_RECORD_TENURE_BAND_ORDER}
          labels={TRACK_RECORD_TENURE_BAND_LABELS}
          placeholder="Select a range"
        />
      </div>

      <div className="space-y-2">
        <Label>Have you been a people manager?</Label>
        <ChoiceButtons
          name="isPeopleManager"
          options={YES_NO_OPTIONS}
          value={isPeopleManager === null ? null : isPeopleManager ? 'yes' : 'no'}
          onChange={(value) => setIsPeopleManager(value === 'yes')}
          columns={2}
        />
      </div>

      <div className="space-y-2">
        <Label>P&amp;L accountability</Label>
        <ChoiceButtons
          name="pnlAccountability"
          options={(Object.keys(TRACK_RECORD_PNL_LABELS) as (keyof typeof TRACK_RECORD_PNL_LABELS)[]).map((value) => ({
            value,
            label: TRACK_RECORD_PNL_LABELS[value],
          }))}
          value={pnlAccountability}
          onChange={setPnlAccountability}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Geographic scope of the roles you&apos;ve held</Label>
        <ChoiceButtons
          name="geographicScope"
          options={(Object.keys(TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS) as (keyof typeof TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS)[]).map(
            (value) => ({ value, label: TRACK_RECORD_GEOGRAPHIC_SCOPE_LABELS[value] })
          )}
          value={geographicScope}
          onChange={setGeographicScope}
          columns={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Highest level you&apos;ve reported to</Label>
        <BandSelect
          name="reportedToLevel"
          value={reportedToLevel}
          onChange={setReportedToLevel}
          options={Object.keys(TRACK_RECORD_REPORTED_TO_LABELS) as (keyof typeof TRACK_RECORD_REPORTED_TO_LABELS)[]}
          labels={TRACK_RECORD_REPORTED_TO_LABELS}
          placeholder="Select a level"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accomplishmentToConfirm">
          One accomplishment you&apos;d want a reference to confirm
        </Label>
        <Textarea
          id="accomplishmentToConfirm"
          name="accomplishmentToConfirm"
          rows={3}
          defaultValue={response?.accomplishmentToConfirm ?? ''}
          placeholder="e.g. Rebuilt the onboarding funnel and cut time-to-first-value by half"
        />
        <p className="text-xs text-muted-foreground">
          This becomes a specific question we ask your references to confirm, add to, or correct.
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save Track Record</SubmitButton>
    </form>
  )
}
