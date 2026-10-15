// Census communications an org can switch on. All off by default: each one
// sends real emails to the org's people.
//   joinReminders: people invited but not joined get a reminder after 5 and
//     12 days (two at most).
//   accessEndingNotice: 14 days before someone's access ends, they're told
//     the date and what to save.

export type CensusComms = { joinReminders: boolean; accessEndingNotice: boolean }

export const COMMS_OFF: CensusComms = { joinReminders: false, accessEndingNotice: false }

export function readComms(json: unknown): CensusComms {
  const o = ((json as { comms?: Partial<CensusComms> } | null)?.comms ?? {}) as Partial<CensusComms>
  return { joinReminders: o.joinReminders === true, accessEndingNotice: o.accessEndingNotice === true }
}

export const REMINDER_DAYS = [5, 12] as const
export const NOTICE_DAYS_BEFORE = 14
