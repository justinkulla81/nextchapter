// Canonical Search Action Task menu — one representative, candidate-facing
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
  { text: 'Follow up on a previous outreach', actionType: 'OUTREACH_FOLLOW_UP' },
  { text: 'Log and close an unanswered application', actionType: 'OUTREACH_CLOSE_APPLICATION' },
  { text: 'Add 5 people to your networking list', actionType: 'NETWORKING_LIST' },

  // Engage
  { text: "Comment thoughtfully on a peer's post", actionType: 'ENGAGE_COMMENT' },
  { text: 'Attend a community event or session', actionType: 'ENGAGE_EVENT' },
  { text: 'Post an update on your own progress', actionType: 'ENGAGE_POST_UPDATE' },
  // Deliberately 0 points (see action-effort.ts) — once a behavior earns
  // points its frequency stops being clean evidence someone would do it
  // without incentive. Shown in the canonical menu anyway so it's a real,
  // selectable option, not just a point-table entry nobody can ever pick.
  {
    text: 'Substantively help a peer — answer a specific question, make an introduction, or support someone through a setback',
    actionType: 'ENGAGE_PEER_SUPPORT',
  },

  // Thought Leadership
  { text: 'Publish a LinkedIn post', actionType: 'LINKEDIN_POST_IDEA' },
  { text: 'Comment on an industry post', actionType: 'THOUGHT_LEADERSHIP_COMMENT' },
  { text: 'Share or repost with a thoughtful comment', actionType: 'THOUGHT_LEADERSHIP_SHARE' },

  // Learning
  { text: 'Complete a course module', actionType: 'LEARNING_MODULE' },
  { text: 'Earn a certificate', actionType: 'LEARNING_CERTIFICATE' },
  { text: 'Try a new AI tool relevant to your target role', actionType: 'LEARNING_NEW_TOOL' },

  // Resume / Assets
  { text: 'Update your resume with quantified achievements', actionType: 'RESUME_UPDATE' },
  { text: 'Run your resume through the Skills Translator', actionType: 'SKILLS_TRANSLATOR' },
  { text: 'Optimize your LinkedIn profile', actionType: 'LINKEDIN_SETUP' },

  // Interview Prep
  { text: 'Complete a mock interview', actionType: 'INTERVIEW_PREP' },
  { text: 'Practice answers to 3 behavioral questions', actionType: 'INTERVIEW_BEHAVIORAL_PRACTICE' },
]
