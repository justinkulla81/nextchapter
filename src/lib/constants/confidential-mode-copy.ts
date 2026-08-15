// Shared copy for Confidential Search Mode (docs/specs/
// NextChapter_Search_Visibility_References_Leaderboards.md PART ONE). Kept
// in one place so the persistent indicator (§6), the settings screen, and
// the turn-off confirmation all describe the same thing the same way — no
// dark patterns, no place where the copy drifts out of sync with what the
// code actually does.

export const CONFIDENTIAL_MODE_INDICATOR_TEXT = 'Confidential Search Mode is on'

// §6: "Settings screen lists plainly what is and isn't visible." Same list
// doubles as the turn-off confirmation's "here's exactly what becomes
// visible" per §3.
export const CONFIDENTIAL_MODE_HIDDEN_ITEMS: string[] = [
  'Your name, employer, title, and location in the Community — you post under a generated handle instead',
  'Any leaderboard — you never appear on one, even if you’d otherwise place',
  'LinkedIn posting — off by default; you have to turn it on deliberately',
  'The "Open to Work" badge — never suggested to you',
  'Outreach scripts default to asking for market perspective, never announcing a search',
  'Email subject lines never mention your job search, resume, applications, or interviews',
  'Only a personal email can connect Gmail — a work account is blocked',
  'Your Dossier is never shown to a recruiter without your specific yes for that recruiter',
  'Your current employer’s name never appears in anything sent to a recruiter',
]

// What still works normally — §5, "the mode removes visibility, never
// capability." Shown alongside the hidden-items list so turning it off (or
// on) never reads as a downgrade.
export const CONFIDENTIAL_MODE_UNCHANGED_ITEMS: string[] = [
  'Your full Market Reality Report and every component grade',
  'Resume Studio, all versions, all tailoring',
  'All assessments, all references, and your full Dossier',
  'Job matching and applications',
  'Coaching',
  'Your badges, points, streaks, and personal bests — earned and shown to you, same as always',
]
