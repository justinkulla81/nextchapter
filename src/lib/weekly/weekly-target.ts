// The weekly time commitment that earns an A in Search Action Grade — grows
// from 2.5 hours in Week 1 by 1 hour/week, flatlining at 7.5 hours/week from
// Week 6 onward. This is the concrete mechanic behind the onboarding
// contract screen's "8 to 12 hours by Week 6" framing (that copy is
// persuasive/approximate; this is the real weekly number the Sprint and
// report pages compute against).

const WEEK1_TARGET_HOURS = 2.5
const WEEKLY_GROWTH_HOURS = 1
const FLATLINE_AT_WEEK = 6

export function weeklyTimeTargetHours(weekNumber: number): number {
  const cappedWeek = Math.min(Math.max(weekNumber, 1), FLATLINE_AT_WEEK)
  return WEEK1_TARGET_HOURS + (cappedWeek - 1) * WEEKLY_GROWTH_HOURS
}

export function weeklyTimeTargetMinutes(weekNumber: number): number {
  return Math.round(weeklyTimeTargetHours(weekNumber) * 60)
}
