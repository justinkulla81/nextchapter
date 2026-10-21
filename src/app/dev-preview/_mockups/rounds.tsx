'use client'

import { PageHeader } from '@/components/candidate/PageHeader'
import { RoundsFlow } from '@/components/rounds/RoundsFlow'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'
import { nextOptionalQuestion } from '@/lib/onboarding/finish'
import { answersFromScores } from '@/lib/redesign/performance-rounds'
import type { RoundAnswers, RoundSaveInput, RoundSaveResult } from '@/lib/redesign/rounds'

// The two long questionnaires as short rounds: the real component, fed sample answers, with a stand-in for the
// save so nothing is written. The track record resumes at round 6 (rounds 1 to 5 are saved); how I perform at round 7.

const save = async (input: RoundSaveInput): Promise<RoundSaveResult> => {
  await new Promise((r) => setTimeout(r, 400))
  return { ok: true, answers: { ...(input.allAnswers ?? {}), ...input.answers }, completed: input.final }
}
const saveNext = async () => ({ saved: true })

const SAMPLE_TRACK_RECORD: RoundAnswers = {
  isPeopleManager: ['yes'],
  largestTeamManaged: ['TWENTY_ONE_TO_FIFTY'],
  peopleHiredDirectly: ['SIX_TO_TWENTY'],
  largestOrgIndirect: ['FIFTY_ONE_TO_TWO_HUNDRED'],
  reportedToLevel: ['C_SUITE'],
  geographicScope: ['MULTI_SITE'],
  budgetOwned: ['ONE_M_TO_10M'],
  pnlAccountability: ['PNL'],
  largestInitiativeScope: ['TEN_M_TO_100M'],
  approvalAuthority: ['HIRING', 'VENDOR_SELECTION'],
  boardExposure: ['PRESENTED_TO'],
  ledThroughRestructuring: ['yes'],
  situationRanking: ['SCALE_WHAT_EXISTS', 'FIX_WHAT_S_BROKEN', 'BUILD_FROM_ZERO', 'RUN_STEADY_STATE'],
  mandateClarity: ['2'],
  droveOutcomesThroughOthers: ['3'],
}
const FULL_TRACK_RECORD: RoundAnswers = {
  ...SAMPLE_TRACK_RECORD,
  functionsOwnedOutsideCore: ['MARKETING', 'FINANCE'],
  sectorHistory: ['TECH', 'HEALTHCARE'],
  stageHistory: ['GROWTH', 'ENTERPRISE'],
  longestTenure: ['FOUR_TO_SEVEN_YEARS'],
  accomplishmentToConfirm: ['Rebuilt the onboarding funnel and cut time to first value by half'],
}
const scores = (upTo: number) => answersFromScores(Object.fromEntries(HOW_I_PERFORM_ITEMS.filter((i) => i.id <= upTo).map((i) => [String(i.id), (i.id % 4) + 1])))

function Frame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="theme-candidate min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader title={title} intro={intro} />
        {children}
      </div>
    </div>
  )
}

const next = nextOptionalQuestion({ networkComfortLevel: null, searching: true })
const trackIntro = 'Seven short rounds on the scope you have owned. Each one is saved as you go, so you can stop any time and pick up later.'
const performIntro = 'Forty statements about how you decide, execute and work through others, in short rounds of two or three. Each round is saved as you go.'

export function TrackRecordRound() {
  return (
    <Frame title="Track record" intro={trackIntro}>
      <RoundsFlow flowId="track_record" initialAnswers={SAMPLE_TRACK_RECORD} completed={false} save={save} next={next} saveNext={saveNext} doneHref="#" doneLabel="Back to how I work" otherHref="#" otherLabel="How I perform: 40 statements in short rounds" />
    </Frame>
  )
}

export function TrackRecordIntro() {
  return (
    <Frame title="Track record" intro={trackIntro}>
      <RoundsFlow flowId="track_record" initialAnswers={{}} completed={false} save={save} next={next} saveNext={saveNext} doneHref="#" doneLabel="Back to how I work" />
    </Frame>
  )
}

export function TrackRecordDone() {
  return (
    <Frame title="Track record" intro={trackIntro}>
      <RoundsFlow flowId="track_record" initialAnswers={FULL_TRACK_RECORD} completed save={save} next={next} saveNext={saveNext} doneHref="#" doneLabel="Back to how I work" otherHref="#" otherLabel="How I perform: 40 statements in short rounds" />
    </Frame>
  )
}

export function HowIPerformRound() {
  return (
    <Frame title="How I perform" intro={performIntro}>
      <RoundsFlow flowId="how_i_perform" initialAnswers={scores(16)} completed={false} save={save} next={next} saveNext={saveNext} doneHref="#" doneLabel="Back to how I work" otherHref="#" otherLabel="Track record: seven short rounds on the scope you have owned" />
    </Frame>
  )
}

export function HowIPerformDone() {
  return (
    <Frame title="How I perform" intro={performIntro}>
      <RoundsFlow flowId="how_i_perform" initialAnswers={scores(39)} completed={false} save={save} next={next} saveNext={saveNext} doneHref="#" doneLabel="Back to how I work" otherHref="#" otherLabel="Track record: seven short rounds on the scope you have owned" />
    </Frame>
  )
}
