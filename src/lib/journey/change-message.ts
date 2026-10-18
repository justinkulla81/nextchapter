// What we tell a member right after their situation changes: what the plan follows now, and that
// what they already did is kept. Pure and client-safe.

import { getJourney, getStage, type JourneyStage, type JourneyType } from './journey'

export function changeMessage(c: { journeyChanged: boolean; stageChanged: boolean; toJourney: JourneyType | null; toStage: JourneyStage | null; plan: { kept: number; replaced: number } | null }): string | null {
  if (!c.journeyChanged && !c.stageChanged) return null
  const follows = c.journeyChanged && c.toJourney ? getJourney(c.toJourney).label : c.toStage ? getStage(c.toStage).label : 'your situation'
  const head = `Your plan now follows ${follows}.`
  if (!c.plan) return `${head} Everything you have done stays.`
  const kept = c.plan.kept === 0 ? 'Everything you have done stays.' : `Your ${c.plan.kept} finished ${c.plan.kept === 1 ? 'step stays' : 'steps stay'}, with their points.`
  return `${head} ${kept}`
}
