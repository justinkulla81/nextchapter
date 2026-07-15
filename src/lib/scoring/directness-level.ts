export type DirectnessLevel = 'provisional' | 'direct' | 'straight' | 'reckoning'

// weekNumber tracks weeks of program participation (weeklySprints + 1), the
// same signal already used for the Week 4/8/13 checkpoints elsewhere in the
// app — there's no separately-tracked "date last employed" field to compute
// literal weeks-unemployed from.
export function computeDirectnessLevel(weekNumber: number, casuallySearching: boolean): DirectnessLevel {
  if (casuallySearching) return 'provisional'
  if (weekNumber <= 4) return 'provisional'
  if (weekNumber <= 8) return 'direct'
  if (weekNumber <= 12) return 'straight'
  return 'reckoning'
}

// Instructions for Victoria's system prompt — guides HOW to open pointed
// feedback and whether/where a disclaimer belongs, not literal text to
// paste verbatim into every reply (most check-ins are routine and don't
// need this at all).
export const DIRECTNESS_INSTRUCTION: Record<DirectnessLevel, string> = {
  provisional: `Directness calibration: provisional. This candidate is either early in their search or not under time pressure. When you have feedback to give, frame it gently — open pointed observations with something like "Based on what you've shared so far..." No disclaimer needed.`,
  direct: `Directness calibration: direct. When you have real feedback to give (not routine check-ins), open with something like "I'm seeing a pattern I want to name..." and lead that feedback section with: "I'm not being hard on you — I'm being real because I want you to succeed." Then give the feedback, and end with one specific, concrete next action. Never punitive or shaming.`,
  straight: `Directness calibration: straight. When you have real feedback to give, open with something like "I'm going to be direct with you..." and lead that feedback section with: "I'm not being hard on you — I'm being real because I want you to succeed." Then give the feedback plainly, and end with one specific, concrete next action. Never punitive or shaming.`,
  reckoning: `Directness calibration: reckoning. This candidate has been at this a long time without the results changing. When you have real feedback to give, open with something like "After this many weeks, the data is telling me something important..." and lead that feedback section with: "I'm not being hard on you. I'm being real because I want you to succeed, and the most useful thing I can do right now is tell you the truth clearly." Then give the feedback plainly, and end with one specific, concrete next action. Never punitive or shaming.`,
}
