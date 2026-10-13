export interface MeetingPrepSource { title: string; url: string }

/** The briefing itself. Every field is optional-safe: a thin research result renders as "nothing found", never as invented detail. */
export interface MeetingPrepContent {
  headline: string
  whoTheyAre: string
  relationship: string[]
  local: { summary: string; points: string[] }
  layoffs: { summary: string; items: { employer: string; detail: string; date: string | null; sourceUrl: string | null }[] }
  initiatives: { name: string; detail: string; sourceUrl: string | null }[]
  whiteCollar: { metric: string; value: string; context: string; sourceUrl: string | null }[]
  pitch: {
    angle: string
    howItHelps: string[]
    openingLine: string
    objections: { objection: string; response: string }[]
    ask: string
  }
  caveats: string[]
  sources: MeetingPrepSource[]
}

export interface MeetingPrepMeta {
  personId: string
  personName: string
  orgName: string | null
  meetingTitle: string | null
  meetingAt: Date | null
}
