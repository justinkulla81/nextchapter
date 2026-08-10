// Canonical Search Action menu — one representative, candidate-facing
// task per scored action type in action-effort.ts's point table. Used to
// top up the LLM-personalized suggestions so there's always enough
// available point volume to actually reach a given week's ramp target
// (the personalized 5-item shortlist alone can fall short by week 3+).
import type { SuggestedActionLike } from '@/lib/weekly/action-effort'

export interface CanonicalTask extends SuggestedActionLike {
  text: string
}

export const CANONICAL_TASK_MENU: CanonicalTask[] = [
  // Outreach
  { text: 'Send a personalized outreach message', actionType: 'OUTREACH_MESSAGE' },
  { text: 'Have a coffee chat or call', actionType: 'OUTREACH_CALL' },
  { text: 'Follow up on a previous outreach', actionType: 'FOLLOW_UP_NOTE_SENT' },
  { text: 'Add new contacts to your networking list', actionType: 'NETWORKING_LIST' },
  { text: 'Add a reference', actionType: 'REFERENCE_ADDED' },

  // Engage
  { text: "Comment thoughtfully on a peer's post", actionType: 'ENGAGE_COMMENT' },
  { text: 'Attend a community event or session', actionType: 'ENGAGE_EVENT' },
  { text: 'Post an update on your own progress', actionType: 'ENGAGE_POST_UPDATE' },
  // Deliberately 0 points (see action-effort.ts) — once a behavior earns
  // points its frequency stops being clean evidence someone would do it
  // without incentive. Shown in the canonical menu anyway so it's a real,
  // selectable option, not just a point-table entry nobody can ever pick.
  { text: 'Help a peer in Support Network', actionType: 'ENGAGE_PEER_SUPPORT' },

  // Thought Leadership
  { text: 'Publish a LinkedIn post', actionType: 'LINKEDIN_POST_IDEA' },
  { text: 'Share or repost a post', actionType: 'THOUGHT_LEADERSHIP_SHARE' },

  // Learning — "start" is the only one offered by default; "complete" only
  // ever gets suggested once the matching start is on record (see
  // getSuggestedActions in sprint.ts), so nobody can claim the full 40/15pt
  // award for a course or certificate they never actually began.
  { text: 'Complete a course module', actionType: 'LEARNING_MODULE' },
  { text: 'Start a certificate program', actionType: 'LEARNING_CERTIFICATE_STARTED' },
  { text: 'Start learning a new tool', actionType: 'LEARNING_NEW_TOOL_STARTED' },

  // Resume / Assets
  { text: 'Update your resume', actionType: 'RESUME_UPDATE' },
  { text: 'Run the Skills Translator', actionType: 'SKILLS_TRANSLATOR' },
  { text: 'Optimize your LinkedIn profile', actionType: 'LINKEDIN_SETUP' },

  // Interview Prep
  { text: 'Complete a mock interview', actionType: 'INTERVIEW_PREP' },
  { text: 'Practice answers to 3 behavioral questions', actionType: 'INTERVIEW_BEHAVIORAL_PRACTICE' },

  // Job search itself — applying, reacting to what's recommended, and
  // tracking companies you want to work for, plus something to bridge the
  // time until you land it. (Previously listed 'Look for full-time jobs'
  // against JOB_BOARD_USAGE_CONFIRMED, but that action type's own check-in
  // UI was removed with nothing rebuilt in its place — see
  // profile-checklist.ts's "dead" comment on the same type — so it could
  // never actually be completed. Replaced with the three real, verified
  // job-search actions below.)
  { text: 'Apply to a new job', actionType: 'JOB_APPLICATION_SUBMITTED' },
  { text: 'React to a job recommendation', actionType: 'JOB_INTERESTED_REACTION' },
  { text: 'Add a company to your tracker', actionType: 'WATCHLIST_ADD' },
  { text: 'Get an interim job to fill the gap', actionType: 'INTERIM_PROFILE_CREATED' },
]
